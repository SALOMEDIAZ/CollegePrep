import supabase from "./supabaseClient";
import { ensureProfileRow, fetchAllergyKeywords, resolveSupabaseProfileId } from "./profileService";
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

export async function fetchAllPlans(userId: string) {
  const dbUserId = await resolveSupabaseProfileId(userId, false);
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
  const { data, error } = await supabase.from("meal_plan_days").select("date,weekday").eq("meal_plan_id", planId);
  if (error) throw error;
  return (data ?? []) as Array<{ date: string; weekday: string | null }>;
}

export async function loadPlanViewModel(userId: string, row: MealPlanRow): Promise<MealPlanViewModel> {
  const cached = readCachedPlan(row);
  if (cached) return cached;

  await resolveSupabaseProfileId(userId, false);
  const profile = await ensureProfileForUser(userId);
  const savedIdsArr = await fetchSavedRecipeIds(profile.id);
  const avoid = await buildAvoidSetsForProfile(profile);

  const days = await fetchMealPlanDays(row.id);
  const selections = emptySelections();
  for (const d of days) {
    const wd = String(d.weekday ?? "").trim() as Weekday;
    if (!wd) continue;
    selections[wd] = { breakfast: true, lunch: true, dinner: true };
  }

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
  });
  writeCachedPlan({ planId: String(row.id), plan: vm, meta: deriveMetaFromRow(row) });
  return vm;
}

export async function selectPlanForRangeAndLoad(userId: string, rows: MealPlanRow[], rangeStartIso: string, rangeEndIso: string) {
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
  const plan = await loadPlanViewModel(userId, row);
  return { planIndex: idx, planId: row.id, plan, selectedDay: defaultSelectedDay(row) };
}
async function fetchSavedRecipeIds(dbUserId: string) {
  const { data, error } = await supabase.from("saved_recipes").select("recipe_id").eq("user_id", dbUserId);
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
  });
  writeCachedPlan({ planId, plan: vm, meta: deriveMetaFromRow(insertedRow) });

  const merged = existingPlans.concat(insertedRow).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const planIndex = merged.findIndex((r) => r.id === planId);
  return { plans: merged, planIndex, planId, plan: vm, selectedDay: defaultSelectedDay(insertedRow) };
}

export async function deletePlanAndSelectNext(userId: string, planId: string, plans: MealPlanRow[], cursorStartIso: string, cursorEndIso: string) {
  const dbUserId = await resolveSupabaseProfileId(userId, false);
  if (!dbUserId) throw new Error("Could not resolve Supabase profile id.");
  const { error: daysErr } = await supabase.from("meal_plan_days").delete().eq("meal_plan_id", planId);
  if (daysErr) throw daysErr;
  const { error: planErr } = await supabase.from("meal_plans").delete().eq("id", planId).eq("user_id", dbUserId);
  if (planErr) throw planErr;
  removeCachedPlan(planId);

  const remaining = plans.filter((p) => p.id !== planId);
  const selected = await selectPlanForRangeAndLoad(userId, remaining, cursorStartIso, cursorEndIso);
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
  writeCachedPlan({ planId, plan: nextPlan, meta: deriveMetaFromPlan(nextPlan) });
  return nextPlan;
}
