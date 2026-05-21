import supabase from "./supabaseClient";
import { ensureProfileRow, fetchAllergyKeywords, fetchProfileByUserId, resolveSupabaseProfileId } from "./profileService";
import type { ProfileRow } from "../types/profile";
import type {
  CreatePlanValues,
  MealPlanRow,
  MealPlanViewModel,
  MealPlanMeal,
  MealType,
  Weekday,
} from "../types/mealPlan";
import {
  addDays,
  buildAvoidKeywordSets,
  buildMealsForSlots,
  defaultSelectedDay,
  findPlanIndexForRange,
  fromISODate,
  getWeekInfoFromStartIso,
  planTitleForRow,
  toISODate,
  weekdayFromDate,
  buildRestrictionValues,
  pickReplacementMeal,
} from "./mealPlanLogic";

const MEAL_PLAN_CACHE_PREFIX = "mealPlanCache:v1:";

type MealPlanCachePayload = {
  v: 1;
  plan: MealPlanViewModel;
  meta?: { start_date?: string; end_date?: string; budget?: number };
};

let mealPlanMealsTableStatus: "unknown" | "missing" | "present" = "unknown";

function canUseLocalStorage() {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function cacheKey(planId: string) {
  return `${MEAL_PLAN_CACHE_PREFIX}${planId}`;
}

function budgetToNumber(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function deriveMetaFromRow(row: Pick<MealPlanRow, "start_date" | "end_date" | "budget">) {
  return { start_date: row.start_date, end_date: row.end_date, budget: budgetToNumber(row.budget) };
}

function deriveMetaFromPlan(plan: MealPlanViewModel) {
  const dates = plan.days.map((d) => String(d.date ?? "")).filter(Boolean).sort();
  const start_date = dates[0];
  const end_date = dates[dates.length - 1];
  return { start_date, end_date, budget: budgetToNumber(plan.budget) };
}

function readCachedPlan(row: Pick<MealPlanRow, "id" | "start_date" | "end_date" | "budget">): MealPlanViewModel | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(String(row.id)));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MealPlanCachePayload> | null;
    if (!parsed || parsed.v !== 1 || !parsed.plan) return null;
    const plan = parsed.plan as MealPlanViewModel;
    if (!Array.isArray((plan as MealPlanViewModel).days)) return null;

    const meta = parsed.meta ?? null;
    if (meta) {
      const rowBudget = budgetToNumber(row.budget);
      if (meta.start_date && meta.start_date !== row.start_date) return null;
      if (meta.end_date && meta.end_date !== row.end_date) return null;
      if (typeof meta.budget === "number" && meta.budget !== rowBudget) return null;
    }

    return plan;
  } catch {
    return null;
  }
}

function writeCachedPlan(args: { planId: string; plan: MealPlanViewModel; meta?: MealPlanCachePayload["meta"] }) {
  if (!canUseLocalStorage()) return;
  try {
    const payload: MealPlanCachePayload = { v: 1, plan: args.plan, meta: args.meta };
    window.localStorage.setItem(cacheKey(args.planId), JSON.stringify(payload));
  } catch {
    return;
  }
}

function removeCachedPlan(planId: string) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.removeItem(cacheKey(planId));
  } catch {
    return;
  }
}

type MealPlanMealRow = {
  meal_plan_id: string;
  date: string;
  weekday: Weekday | null;
  meal_type: MealType;
  recipe_id: string;
  recipe_name: string;
  recipe_thumb: string | null;
  cost: number;
};

type MealPlanDayRow = { date: string; weekday: string | null; meals?: unknown | null; meals_json?: unknown | null };

function isMissingMealPlanMealsTableError(err: unknown) {
  const msg = String((err as { message?: unknown })?.message ?? err);
  return (
    msg.includes("schema cache") ||
    msg.includes("Could not find the table") ||
    msg.includes("does not exist") ||
    msg.includes("relation") ||
    msg.includes("column")
  );
}

function weekdayFromISODate(iso: string): Weekday {
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setHours(0, 0, 0, 0);
  const map: Weekday[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return map[dt.getDay()] ?? "Mon";
}

function buildPlanFromPersistedMeals(args: {
  title: string;
  budget: number;
  daysRows: Array<{ date: string; weekday: string | null }>;
  mealRows: MealPlanMealRow[];
}) {
  const byDate = new Map<string, { date: string; weekday: Weekday; meals: MealPlanMeal[] }>();
  for (const d of args.daysRows) {
    const date = String(d.date ?? "").trim();
    if (!date) continue;
    const wd = (String(d.weekday ?? "").trim() as Weekday) || weekdayFromISODate(date);
    byDate.set(date, { date, weekday: wd, meals: [] });
  }
  for (const r of args.mealRows) {
    const date = String(r.date ?? "").trim();
    if (!date) continue;
    const existing = byDate.get(date);
    const weekday = existing?.weekday ?? (r.weekday ?? weekdayFromISODate(date));
    const bucket = existing ?? { date, weekday, meals: [] as MealPlanMeal[] };
    bucket.meals.push({
      mealType: r.meal_type,
      recipeId: String(r.recipe_id ?? ""),
      recipeName: String(r.recipe_name ?? ""),
      recipeThumb: r.recipe_thumb ?? null,
      cost: Number(r.cost ?? 0) || 0,
    });
    if (!existing) byDate.set(date, bucket);
  }
  const days = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  const used = days.flatMap((d) => d.meals).reduce((acc, m) => acc + Number(m.cost ?? 0), 0);
  return { title: args.title, budget: args.budget, used, days } satisfies MealPlanViewModel;
}

function mealsFromUnknown(value: unknown): MealPlanMeal[] {
  const arr = Array.isArray(value) ? value : null;
  if (!arr) return [];
  const out: MealPlanMeal[] = [];
  for (const item of arr) {
    const r = item as Record<string, unknown>;
    const mealType = String((r.mealType ?? r.meal_type ?? "") as string).trim() as MealType;
    if (mealType !== "breakfast" && mealType !== "lunch" && mealType !== "dinner") continue;
    const recipeId = String((r.recipeId ?? r.recipe_id ?? "") as string).trim();
    if (!recipeId) continue;
    const recipeName = String((r.recipeName ?? r.recipe_name ?? recipeId) as string).trim() || recipeId;
    const recipeThumbRaw = r.recipeThumb ?? r.recipe_thumb ?? null;
    const recipeThumb = recipeThumbRaw ? String(recipeThumbRaw) : null;
    const cost = Number(r.cost ?? 0) || 0;
    out.push({ mealType, recipeId, recipeName, recipeThumb, cost });
  }
  return out;
}

function buildPlanFromDaysRowsWithMeals(args: {
  title: string;
  budget: number;
  daysRows: MealPlanDayRow[];
}) {
  const days = args.daysRows
    .map((d) => {
      const date = String(d.date ?? "").trim();
      if (!date) return null;
      const wd = (String(d.weekday ?? "").trim() as Weekday) || weekdayFromISODate(date);
      const meals = mealsFromUnknown(d.meals ?? d.meals_json);
      return { date, weekday: wd, meals };
    })
    .filter((x): x is MealPlanViewModel["days"][number] => Boolean(x))
    .sort((a, b) => a.date.localeCompare(b.date));
  const used = days.flatMap((d) => d.meals).reduce((acc, m) => acc + Number(m.cost ?? 0), 0);
  return { title: args.title, budget: args.budget, used, days } satisfies MealPlanViewModel;
}

async function fetchPersistedMeals(planId: string): Promise<MealPlanMealRow[] | null> {
  if (mealPlanMealsTableStatus === "missing") return null;
  const { data, error } = await supabase
    .from("meal_plan_meals")
    .select("meal_plan_id,date,weekday,meal_type,recipe_id,recipe_name,recipe_thumb,cost")
    .eq("meal_plan_id", planId)
    .order("date", { ascending: true });
  if (error) {
    if (isMissingMealPlanMealsTableError(error)) {
      mealPlanMealsTableStatus = "missing";
      return null;
    }
    mealPlanMealsTableStatus = "present";
    throw error;
  }
  mealPlanMealsTableStatus = "present";
  const rows = (data ?? []) as MealPlanMealRow[];
  return rows;
}

async function persistMeals(planId: string, plan: MealPlanViewModel) {
  if (mealPlanMealsTableStatus === "missing") return;
  const rows: MealPlanMealRow[] = [];
  for (const d of plan.days) {
    for (const m of d.meals) {
      rows.push({
        meal_plan_id: planId,
        date: d.date,
        weekday: d.weekday,
        meal_type: m.mealType,
        recipe_id: m.recipeId,
        recipe_name: m.recipeName,
        recipe_thumb: m.recipeThumb ?? null,
        cost: Number(m.cost ?? 0) || 0,
      });
    }
  }
  if (!rows.length) return;
  const { error } = await supabase.from("meal_plan_meals").upsert(rows, { onConflict: "meal_plan_id,date,meal_type" });
  if (!error) {
    mealPlanMealsTableStatus = "present";
    return;
  }
  if (isMissingMealPlanMealsTableError(error)) {
    mealPlanMealsTableStatus = "missing";
    return;
  }
  mealPlanMealsTableStatus = "present";

  const { error: delErr } = await supabase.from("meal_plan_meals").delete().eq("meal_plan_id", planId);
  if (delErr) throw delErr;
  const { error: insErr } = await supabase.from("meal_plan_meals").insert(rows);
  if (insErr) throw insErr;
}

async function removePersistedMeals(planId: string) {
  if (mealPlanMealsTableStatus === "missing") return;
  try {
    const { error } = await supabase.from("meal_plan_meals").delete().eq("meal_plan_id", planId);
    if (error) {
      if (isMissingMealPlanMealsTableError(error)) {
        mealPlanMealsTableStatus = "missing";
        return;
      }
      mealPlanMealsTableStatus = "present";
      throw error;
    }
    mealPlanMealsTableStatus = "present";
  } catch {
    return;
  }
}

async function persistMealsOnDaysTable(planId: string, plan: MealPlanViewModel) {
  try {
    for (const d of plan.days) {
      const { error } = await supabase.from("meal_plan_days").update({ meals: d.meals }).eq("meal_plan_id", planId).eq("date", d.date);
      if (!error) continue;
      const { error: error2 } = await supabase
        .from("meal_plan_days")
        .update({ meals_json: d.meals })
        .eq("meal_plan_id", planId)
        .eq("date", d.date);
      if (error2) return;
    }
  } catch {
    return;
  }
}

async function updateOneMealOnDaysTable(planId: string, date: string, nextMeals: MealPlanMeal[]) {
  try {
    const { error } = await supabase.from("meal_plan_days").update({ meals: nextMeals }).eq("meal_plan_id", planId).eq("date", date);
    if (!error) return;
    await supabase.from("meal_plan_days").update({ meals_json: nextMeals }).eq("meal_plan_id", planId).eq("date", date);
  } catch {
    return;
  }
}

export async function fetchAllPlans(userId: string) {
  const dbUserId = await resolveSupabaseProfileId(userId, true);
  if (!dbUserId) return [];
  const { data, error } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("user_id", dbUserId)
    .order("start_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MealPlanRow[];
}

export async function ensureProfileForUser(userId: string) {
  const { profile, error } = await ensureProfileRow(userId);
  if (error) {
    const msg = String((error as { message?: unknown })?.message ?? error);
    throw new Error(`Profile row is missing or cannot be created. ${msg}`);
  }
  return profile;
}

function emptySelections() {
  const allFalse = { breakfast: false, lunch: false, dinner: false };
  const days: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const out = {} as CreatePlanValues["selections"];
  for (const d of days) out[d] = { ...allFalse };
  return out;
}

async function buildAvoidSetsForProfile(profile: Awaited<ReturnType<typeof ensureProfileForUser>> | null) {
  if (!profile) return { allergyAvoid: new Set<string>(), dietAvoid: new Set<string>() };
  const restrictionValues = buildRestrictionValues(profile);
  const allergyKeywords = await fetchAllergyKeywords(restrictionValues);
  return buildAvoidKeywordSets(profile, allergyKeywords);
}

async function fetchMealPlanDays(planId: string) {
  try {
    const { data, error } = await supabase.from("meal_plan_days").select("date,weekday,meals").eq("meal_plan_id", planId);
    if (error) throw error;
    return (data ?? []) as MealPlanDayRow[];
  } catch {
    try {
      const { data, error } = await supabase.from("meal_plan_days").select("date,weekday,meals_json").eq("meal_plan_id", planId);
      if (error) throw error;
      return (data ?? []) as MealPlanDayRow[];
    } catch {
      const { data, error } = await supabase.from("meal_plan_days").select("date,weekday").eq("meal_plan_id", planId);
      if (error) throw error;
      return (data ?? []) as MealPlanDayRow[];
    }
  }
}

export async function loadPlanViewModel(row: MealPlanRow): Promise<MealPlanViewModel> {
  const cached = readCachedPlan(row);
  if (cached) return cached;

  const days = await fetchMealPlanDays(row.id);
  const anyMealsOnDays = days.some((d) => {
    const v = d.meals ?? d.meals_json;
    return Array.isArray(v) && v.length > 0;
  });
  if (anyMealsOnDays) {
    const budget = Number(row.budget ?? 0) || 0;
    const vm = buildPlanFromDaysRowsWithMeals({
      title: planTitleForRow(row),
      budget,
      daysRows: days,
    });
    writeCachedPlan({ planId: String(row.id), plan: vm, meta: deriveMetaFromRow(row) });
    return vm;
  }

  const persistedMeals = await fetchPersistedMeals(String(row.id));
  if (persistedMeals && persistedMeals.length) {
    const budget = Number(row.budget ?? 0) || 0;
    const vm = buildPlanFromPersistedMeals({
      title: planTitleForRow(row),
      budget,
      daysRows: days,
      mealRows: persistedMeals,
    });
    writeCachedPlan({ planId: String(row.id), plan: vm, meta: deriveMetaFromRow(row) });
    return vm;
  }

  const selections = emptySelections();
  for (const d of days) {
    const wd = String(d.weekday ?? "").trim() as Weekday;
    if (!wd) continue;
    selections[wd] = { breakfast: true, lunch: true, dinner: true };
  }

  const profileId = String(row.user_id ?? "").trim();
  const { profile, error } = await fetchProfileByUserId(profileId);
  const safeProfile: ProfileRow | null = error ? null : profile;
  const savedIdsArr = profileId ? await fetchSavedRecipeIds(profileId) : [];
  const avoid = await buildAvoidSetsForProfile(safeProfile);

  const values: CreatePlanValues = {
    budget: Number(row.budget ?? 0) || 0,
    onlySavedRecipes: Boolean(row.only_saved_recipes),
    onlyNewRecipes: Boolean(row.only_new_recipes),
    selections,
  };

  const rangeStart = fromISODate(row.start_date);
  const rangeEnd = fromISODate(row.end_date);
  const vm = await buildMealsForSlots({
    values,
    savedIdsArr,
    weekTitle: planTitleForRow(row),
    rangeStart,
    rangeEnd,
    avoid,
    seed: String(row.id),
  });
  await persistMeals(String(row.id), vm);
  await persistMealsOnDaysTable(String(row.id), vm);
  writeCachedPlan({ planId: String(row.id), plan: vm, meta: deriveMetaFromRow(row) });
  return vm;
}

export async function selectPlanForRangeAndLoad(rows: MealPlanRow[], rangeStartIso: string, rangeEndIso: string) {
  const idx = findPlanIndexForRange(rows, rangeStartIso, rangeEndIso);
  const row = rows[idx];
  if (!row) {
    return {
      planIndex: -1,
      planId: null as string | null,
      plan: null as MealPlanViewModel | null,
      selectedDay: null as string | null,
    };
  }
  const plan = await loadPlanViewModel(row);
  return { planIndex: idx, planId: row.id, plan, selectedDay: defaultSelectedDay(row) };
}
async function fetchSavedRecipeIds(dbUserId: string) {
  const { data, error } = await supabase
    .from("saved_recipes")
    .select("recipe_id")
    .eq("user_id", dbUserId)
    .order("recipe_id", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as Array<{ recipe_id: string | null }>;
  return rows.map((r) => String(r.recipe_id ?? "")).filter(Boolean);
}

async function insertMealPlanDays(planId: string, values: CreatePlanValues, rangeStart: Date, rangeEnd: Date) {
  const daysRows: Array<{ meal_plan_id: string; date: string; weekday: string }> = [];
  const days = Math.max(0, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000)));
  for (let i = 0; i <= days; i++) {
    const d = addDays(rangeStart, i);
    const wd = weekdayFromDate(d);
    const anySelected = Object.values(values.selections[wd]).some(Boolean);
    if (!anySelected) continue;
    daysRows.push({ meal_plan_id: planId, date: toISODate(d), weekday: wd });
  }
  if (!daysRows.length) return;
  const { error: daysErr } = await supabase.from("meal_plan_days").insert(daysRows);
  if (daysErr) throw daysErr;
}

export async function createWeekPlanAndLoad(userId: string, values: CreatePlanValues, existingPlans: MealPlanRow[], cursorWeekStartIso: string) {
  const dbUserId = await resolveSupabaseProfileId(userId, true);
  if (!dbUserId) throw new Error("Could not resolve Supabase profile id.");
  const profile = await ensureProfileForUser(dbUserId);
  const profileId = profile.id;
  const cursorWeek = getWeekInfoFromStartIso(cursorWeekStartIso, new Date());
  const todayIso = toISODate(new Date());
  const planStartIso = todayIso >= cursorWeek.startIso && todayIso <= cursorWeek.endIso ? todayIso : cursorWeek.startIso;

  const existingForWeek = existingPlans
    .filter((p) => String(p.user_id ?? "") === String(profileId))
    .filter((p) => p.start_date >= cursorWeek.startIso && p.start_date <= cursorWeek.endIso && p.end_date === cursorWeek.endIso)
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  const reuse = existingForWeek[0];
  if (reuse) {
    const plan = await loadPlanViewModel(reuse);
    return {
      plans: existingPlans,
      planIndex: existingPlans.findIndex((p) => p.id === reuse.id),
      planId: reuse.id,
      plan,
      selectedDay: defaultSelectedDay(reuse),
    };
  }

  const planInsert = {
    user_id: profileId,
    name: cursorWeek.title,
    start_date: planStartIso,
    end_date: cursorWeek.endIso,
    budget: values.budget,
    only_saved_recipes: values.onlySavedRecipes,
    only_new_recipes: values.onlyNewRecipes,
  };

  const { data: insertedPlan, error: insErr } = await supabase.from("meal_plans").insert(planInsert).select("*").single();
  if (insErr) throw insErr;
  const insertedRow = insertedPlan as MealPlanRow | null;
  const planId = String(insertedRow?.id ?? "");
  if (!insertedRow || !planId) throw new Error("Failed to create meal plan");

  const rangeStart = fromISODate(planStartIso);
  const rangeEnd = fromISODate(cursorWeek.endIso);
  await insertMealPlanDays(planId, values, rangeStart, rangeEnd);
  const savedIdsArr = await fetchSavedRecipeIds(profileId);
  const avoid = await buildAvoidSetsForProfile(profile);
  const vm = await buildMealsForSlots({
    values,
    savedIdsArr,
    weekTitle: planTitleForRow(insertedRow),
    rangeStart,
    rangeEnd,
    avoid,
    seed: planId,
  });
  await persistMeals(planId, vm);
  await persistMealsOnDaysTable(planId, vm);
  writeCachedPlan({ planId, plan: vm, meta: deriveMetaFromRow(insertedRow) });

  const merged = existingPlans.concat(insertedRow).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const planIndex = merged.findIndex((r) => r.id === planId);
  return { plans: merged, planIndex, planId, plan: vm, selectedDay: defaultSelectedDay(insertedRow) };
}

export async function deletePlanAndSelectNext(userId: string, planId: string, plans: MealPlanRow[], cursorStartIso: string, cursorEndIso: string) {
  const dbUserId = await resolveSupabaseProfileId(userId, false);
  if (!dbUserId) throw new Error("Could not resolve Supabase profile id.");
  await removePersistedMeals(planId);
  const { error: daysErr } = await supabase.from("meal_plan_days").delete().eq("meal_plan_id", planId);
  if (daysErr) throw daysErr;
  const { error: planErr } = await supabase.from("meal_plans").delete().eq("id", planId).eq("user_id", dbUserId);
  if (planErr) throw planErr;
  removeCachedPlan(planId);

  const remaining = plans.filter((p) => p.id !== planId);
  const selected = await selectPlanForRangeAndLoad(remaining, cursorStartIso, cursorEndIso);
  return { plans: remaining, ...selected };
}

export async function replaceMealInPlan(
  userId: string,
  planId: string,
  plan: MealPlanViewModel,
  planRow: Pick<MealPlanRow, "only_saved_recipes" | "only_new_recipes">,
  target: { date: string; mealType: MealType; recipeId: string },
) {
  const dbUserId = await resolveSupabaseProfileId(userId, false);
  if (!dbUserId) throw new Error("Could not resolve Supabase profile id.");
  const dayIdx = plan.days.findIndex((d) => d.date === target.date);
  if (dayIdx < 0) throw new Error("Day not found in plan.");
  const day = plan.days[dayIdx];
  const mealIdx = day.meals.findIndex((m) => m.mealType === target.mealType && m.recipeId === target.recipeId);
  if (mealIdx < 0) throw new Error("Meal not found in plan.");

  const oldMeal = day.meals[mealIdx];
  const oldCost = Number(oldMeal.cost ?? 0) || 0;
  const usedWithout = plan.used - oldCost;
  const available = Math.max(0, Number(plan.budget ?? 0) - usedWithout);
  if (!(available > 0)) throw new Error("No remaining budget to replace this meal.");

  const profile = await ensureProfileForUser(userId);
  const savedIdsArr = await fetchSavedRecipeIds(dbUserId);
  const avoid = await buildAvoidSetsForProfile(profile);

  const usedRecipes = new Set<string>();
  for (const d of plan.days) {
    for (const m of d.meals) {
      if (d.date === target.date && m.mealType === target.mealType && m.recipeId === target.recipeId) continue;
      usedRecipes.add(String(m.recipeId));
    }
  }

  const exclude = new Set<string>(usedRecipes);
  const picked = await pickReplacementMeal({
    savedIdsArr,
    onlySavedRecipes: Boolean(planRow.only_saved_recipes),
    onlyNewRecipes: Boolean(planRow.only_new_recipes),
    availableBudget: available,
    avoid,
    excludeIds: exclude,
  });
  if (!picked) throw new Error("No replacement recipe fits your budget and preferences.");

  const updatedMeal: MealPlanMeal = {
    mealType: oldMeal.mealType,
    recipeId: picked.recipeId,
    recipeName: picked.recipeName,
    recipeThumb: picked.recipeThumb,
    cost: picked.cost,
  };

  const nextDays = plan.days.map((d, i) => {
    if (i !== dayIdx) return d;
    const nextMeals = d.meals.map((m, j) => (j === mealIdx ? updatedMeal : m));
    return { ...d, meals: nextMeals };
  });

  const nextUsed = usedWithout + Number(picked.cost ?? 0);
  const nextPlan: MealPlanViewModel = { ...plan, used: nextUsed, days: nextDays };
  await updateOneMealOnDaysTable(planId, target.date, nextDays[dayIdx]?.meals ?? []);
  if (mealPlanMealsTableStatus !== "missing") {
    try {
      const { error } = await supabase.from("meal_plan_meals").upsert(
        [
          {
            meal_plan_id: planId,
            date: target.date,
            weekday: day.weekday,
            meal_type: target.mealType,
            recipe_id: updatedMeal.recipeId,
            recipe_name: updatedMeal.recipeName,
            recipe_thumb: updatedMeal.recipeThumb ?? null,
            cost: Number(updatedMeal.cost ?? 0) || 0,
          } satisfies MealPlanMealRow,
        ],
        { onConflict: "meal_plan_id,date,meal_type" },
      );
      if (error) {
        if (isMissingMealPlanMealsTableError(error)) mealPlanMealsTableStatus = "missing";
        else mealPlanMealsTableStatus = "present";
      } else {
        mealPlanMealsTableStatus = "present";
      }
    } catch (e) {
      if (isMissingMealPlanMealsTableError(e)) mealPlanMealsTableStatus = "missing";
    }
  }
  writeCachedPlan({ planId, plan: nextPlan, meta: deriveMetaFromPlan(nextPlan) });
  return nextPlan;
}
