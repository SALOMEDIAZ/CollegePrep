import supabase from "./supabaseClient";
import { searchMealsByFirstLetter, type MealDbMeal } from "./api";
import { ensureProfileRow, fetchAllergyKeywords, type ProfileRow } from "./profileSupabase";
import type {
  CreatePlanValues,
  MealPlanDay,
  MealPlanMeal,
  MealPlanRow,
  MealPlanViewModel,
  MealType,
  SavedRecipeRow,
  Weekday,
} from "../types/mealPlan";
import { resolveMealWithCost } from "./ingredientPricing";

function startOfWeekMonday(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const mondayBased = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - mondayBased);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function fromISODate(s: string) {
  const [y, m, d] = s.split("-").map((x) => Number(x));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

export function addDaysISO(iso: string, delta: number) {
  const dt = fromISODate(iso);
  dt.setDate(dt.getDate() + delta);
  return toISODate(dt);
}

export function formatDayTitle(iso: string) {
  const dt = fromISODate(iso);
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(dt);
  const md = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(dt);
  return `${wd}, ${md}`;
}

function formatWeekTitle(start: Date, end: Date) {
  const m = new Intl.DateTimeFormat("en-US", { month: "short" });
  return `Next week, ${m.format(start)} ${start.getDate()}-${end.getDate()}`;
}

function weekLabelForRange(start: Date, end: Date, now = new Date()) {
  const todayIso = toISODate(now);
  const s = toISODate(start);
  const e = toISODate(end);
  return todayIso >= s && todayIso <= e ? "This week" : "Week";
}

function formatWeekTitleWithLabel(start: Date, end: Date, label: string) {
  const m = new Intl.DateTimeFormat("en-US", { month: "short" });
  return `${label}, ${m.format(start)} ${start.getDate()}-${end.getDate()}`;
}

export function getWeekInfoForDate(now = new Date(), offsetWeeks = 0) {
  const base = startOfWeekMonday(now);
  const start = addDays(base, offsetWeeks * 7);
  const end = addDays(start, 6);
  const label = weekLabelForRange(start, end, now);
  return {
    start,
    end,
    startIso: toISODate(start),
    endIso: toISODate(end),
    title: formatWeekTitleWithLabel(start, end, label),
  };
}

export function getWeekInfoFromStartIso(startIso: string, now = new Date()) {
  const start = fromISODate(startIso);
  const end = addDays(start, 6);
  const label = weekLabelForRange(start, end, now);
  return {
    start,
    end,
    startIso: toISODate(start),
    endIso: toISODate(end),
    title: formatWeekTitleWithLabel(start, end, label),
  };
}

export function getNextWeekInfo(now = new Date()) {
  const base = getWeekInfoForDate(now, 1);
  return { ...base, title: formatWeekTitle(base.start, base.end) };
}

export function planTitleForRow(row: MealPlanRow) {
  const s = new Date(row.start_date);
  const e = new Date(row.end_date);
  const label = (() => {
    const now = new Date();
    if (now >= new Date(row.start_date) && now <= new Date(row.end_date)) return "This week";
    return "Week";
  })();
  const m = new Intl.DateTimeFormat("en-US", { month: "short" });
  return `${label}, ${m.format(s)} ${s.getDate()}-${e.getDate()}`;
}

function weekdayFromDate(d: Date): Weekday {
  const map: Weekday[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const x = map[d.getDay()];
  return x === "Sun" ? "Sun" : x;
}

export function defaultSelectedDay(row: MealPlanRow) {
  const now = new Date();
  const s = new Date(row.start_date);
  const e = new Date(row.end_date);
  if (now >= s && now <= e) return toISODate(now);
  return row.start_date;
}

function localPlanKey(userId: string, planId: string) {
  return `mealplan:${userId}:${planId}`;
}

function localLastPlanKey(userId: string) {
  return `mealplan:last:${userId}`;
}

function safeGetLocalStorageItem(key: string) {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLocalStorageItem(key: string, value: string) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

function safeRemoveLocalStorageItem(key: string) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    return;
  }
}

export function buildPlanFromRow(userId: string, row: MealPlanRow) {
  const pid = row.id;
  const raw = safeGetLocalStorageItem(localPlanKey(userId, pid));
  if (raw) {
    const parsed = JSON.parse(raw) as MealPlanViewModel;
    return { ...parsed, title: planTitleForRow(row) };
  }
  const budget = Number(row.budget ?? 0) || 0;
  return { title: planTitleForRow(row), budget, used: 0, days: [] } as MealPlanViewModel;
}

export function pickInitialPlanIndex(userId: string, rows: MealPlanRow[]) {
  const lastId = safeGetLocalStorageItem(localLastPlanKey(userId));
  if (lastId) {
    const idx = rows.findIndex((r) => r.id === lastId);
    if (idx >= 0) return idx;
  }
  const todayIso = toISODate(new Date());
  let idx = rows.findIndex((r) => r.end_date >= todayIso);
  if (idx < 0) idx = rows.length - 1;
  return idx;
}

export function selectPlanByIndex(userId: string, rows: MealPlanRow[], idx: number) {
  const row = rows[idx];
  if (!row) {
    return {
      planIndex: -1,
      planId: null as string | null,
      plan: null as MealPlanViewModel | null,
      selectedDay: null as string | null,
    };
  }
  const planId = row.id;
  const plan = buildPlanFromRow(userId, row);
  const selectedDay = defaultSelectedDay(row);
  safeSetLocalStorageItem(localLastPlanKey(userId), planId);
  return { planIndex: idx, planId, plan, selectedDay };
}

export function shiftWeekStartIso(startIso: string, deltaWeeks: number) {
  return addDaysISO(startIso, deltaWeeks * 7);
}

export function selectPlanForRange(userId: string, rows: MealPlanRow[], rangeStartIso: string, rangeEndIso: string) {
  const idx = rows.findIndex((r) => r.start_date <= rangeEndIso && r.end_date >= rangeStartIso);
  return selectPlanByIndex(userId, rows, idx);
}

export async function fetchAllPlans(userId: string) {
  const { data, error } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("user_id", userId)
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

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dietKeysFromProfile(profile: ProfileRow | null) {
  if (!profile) return [];
  const keys: string[] = [];
  if (profile.vegan) keys.push("vegan");
  else if (profile.vegetarian) keys.push("vegetarian");
  if (profile.gluten_free) keys.push("gluten_free", "gluten");
  if (profile.lactose_free) keys.push("lactose_free", "lactose");
  return keys;
}

function fallbackDietKeywords(dietKeys: string[]) {
  const wantsVeg = dietKeys.includes("vegan") || dietKeys.includes("vegetarian");
  if (!wantsVeg) return [];
  const baseNoMeat = ["meat", "beef", "pork", "chicken", "turkey", "lamb", "fish", "seafood", "shrimp"];
  const veganExtras = ["egg", "milk", "cheese", "butter", "cream", "yogurt", "honey"];
  return dietKeys.includes("vegan") ? baseNoMeat.concat(veganExtras) : baseNoMeat;
}

async function buildRestrictionKeywordSets(profile: ProfileRow | null) {
  if (!profile) return { allergyAvoid: new Set<string>(), dietAvoid: new Set<string>() };
  const allergyValues = (Array.isArray(profile.allergies) ? profile.allergies : []).map((x) => String(x ?? ""));
  const dietKeys = dietKeysFromProfile(profile);
  const restrictionValues = allergyValues.concat(dietKeys);
  const allergyKeywords = await fetchAllergyKeywords(restrictionValues);
  const combined = allergyKeywords.concat(fallbackDietKeywords(dietKeys));

  const allergyAvoid = new Set<string>();
  for (const v of restrictionValues) {
    const n = norm(String(v));
    if (n) allergyAvoid.add(n);
  }
  for (const kw of combined) {
    const n = norm(String(kw));
    if (n) allergyAvoid.add(n);
  }

  return { allergyAvoid, dietAvoid: new Set<string>() };
}

function matchesAnyKeyword(text: string, keywords: Set<string>) {
  if (!keywords.size) return false;
  const t = norm(text);
  if (!t) return false;
  for (const k of keywords) {
    if (!k) continue;
    if (t === k) return true;
    if (t.includes(k)) return true;
  }
  return false;
}

function extractMealIngredientNames(meal: MealDbMeal) {
  const out: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const k = `strIngredient${i}`;
    const v = String((meal as unknown as Record<string, unknown>)[k] ?? "").trim();
    if (v) out.push(v);
  }
  return out;
}

function mealAllowedWithSets(meal: MealDbMeal, allergyAvoid: Set<string>, dietAvoid: Set<string>) {
  const ingredients = extractMealIngredientNames(meal);
  for (const ing of ingredients) {
    if (matchesAnyKeyword(ing, allergyAvoid)) return false;
    if (matchesAnyKeyword(ing, dietAvoid)) return false;
  }
  const title = String(meal.strMeal ?? "");
  const category = String(meal.strCategory ?? "");
  if (matchesAnyKeyword(title, allergyAvoid)) return false;
  if (matchesAnyKeyword(title, dietAvoid)) return false;
  if (matchesAnyKeyword(category, allergyAvoid)) return false;
  if (matchesAnyKeyword(category, dietAvoid)) return false;
  return true;
}

function sampleUnique<T>(items: T[], count: number) {
  if (count <= 0) return [];
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(count, arr.length));
}

async function fetchSavedRecipeIds(userId: string) {
  const { data, error } = await supabase.from("saved_recipes").select("recipe_id").eq("user_id", userId);
  if (error) throw error;
  const rows = (data ?? []) as Array<Pick<SavedRecipeRow, "recipe_id">>;
  return rows.map((r) => String(r.recipe_id)).filter(Boolean);
}

async function buildNewRecipePool(allergyAvoid: Set<string>, dietAvoid: Set<string>, minCount: number, excludeIds: Set<string>) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
  const pickedLetters = new Set<string>();
  const pool: string[] = [];
  const seen = new Set<string>();

  for (let round = 0; round < 10 && pool.length < minCount; round++) {
    const letters = sampleUnique(
      alphabet.filter((l) => !pickedLetters.has(l)),
      3,
    );
    if (!letters.length) break;
    letters.forEach((l) => pickedLetters.add(l));
    const lists = await Promise.all(letters.map((l) => searchMealsByFirstLetter(l)));
    for (const list of lists) {
      for (const m of list) {
        const id = String(m?.idMeal ?? "");
        if (!id) continue;
        if (excludeIds.has(id)) continue;
        if (seen.has(id)) continue;
        if (!mealAllowedWithSets(m, allergyAvoid, dietAvoid)) continue;
        seen.add(id);
        pool.push(id);
        if (pool.length >= minCount) break;
      }
      if (pool.length >= minCount) break;
    }
  }

  return pool;
}

function buildPlanViewModel(title: string, budget: number, days: MealPlanDay[]) {
  const used = days.flatMap((d) => d.meals).reduce((acc, m) => acc + Number(m.cost ?? 0), 0);
  const vm: MealPlanViewModel = { title, budget, used, days };
  return vm;
}

function buildSelectedSlots(values: CreatePlanValues, rangeStart: Date, rangeEnd: Date) {
  const slots: Array<{ date: string; weekday: Weekday; mealType: MealType }> = [];
  const days = Math.max(0, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000)));
  for (let i = 0; i <= days; i++) {
    const d = addDays(rangeStart, i);
    const wd = weekdayFromDate(d);
    const sel = values.selections[wd];
    (["breakfast", "lunch", "dinner"] as MealType[]).forEach((mt) => {
      if (sel[mt]) slots.push({ date: toISODate(d), weekday: wd, mealType: mt });
    });
  }
  return slots;
}

async function buildMealsForSlots(values: CreatePlanValues, profile: ProfileRow | null, userId: string, weekTitle: string, rangeStart: Date, rangeEnd: Date) {
  const savedIdsArr = await fetchSavedRecipeIds(userId);
  const savedIds = new Set(savedIdsArr);
  const { allergyAvoid, dietAvoid } = await buildRestrictionKeywordSets(profile);
  const newPool = values.onlySavedRecipes
    ? []
    : await buildNewRecipePool(allergyAvoid, dietAvoid, 120, values.onlyNewRecipes ? savedIds : new Set<string>());

  const slots = buildSelectedSlots(values, rangeStart, rangeEnd);
  const mealCache = new Map<string, Awaited<ReturnType<typeof resolveMealWithCost>>>();
  const usedRecipes = new Set<string>();
  let remaining = values.budget;

  async function getCached(mealId: string) {
    if (mealCache.has(mealId)) return mealCache.get(mealId) ?? null;
    const r = await resolveMealWithCost(mealId);
    mealCache.set(mealId, r);
    return r;
  }

  async function pickOne() {
    const maxAttempts = 80;
    for (let i = 0; i < maxAttempts; i++) {
      const fromSaved = values.onlySavedRecipes || (!values.onlyNewRecipes && savedIdsArr.length > 0 && Math.random() < 0.4);
      const source = fromSaved ? savedIdsArr : newPool;
      if (!source.length) continue;
      const id = source[Math.floor(Math.random() * source.length)];
      if (!id) continue;
      if (usedRecipes.has(id)) continue;
      const resolved = await getCached(id);
      if (!resolved) continue;
      const c = Number(resolved.cost ?? 0);
      if (!Number.isFinite(c) || c <= 0) continue;
      if (c > remaining) continue;
      usedRecipes.add(id);
      remaining -= c;
      return resolved;
    }
    return null;
  }

  const dayMap = new Map<string, MealPlanDay>();
  for (const s of slots) {
    if (remaining <= 0) break;
    const picked = await pickOne();
    if (!picked) continue;
    const mealItem: MealPlanMeal = {
      mealType: s.mealType,
      recipeId: picked.recipeId,
      recipeName: picked.recipeName,
      recipeThumb: picked.recipeThumb,
      cost: picked.cost,
    };
    const key = s.date;
    const existing = dayMap.get(key);
    if (existing) {
      existing.meals.push(mealItem);
    } else {
      dayMap.set(key, { date: s.date, weekday: s.weekday, meals: [mealItem] });
    }
  }

  const days = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  return buildPlanViewModel(weekTitle, values.budget, days);
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
  const profile = await ensureProfileForUser(userId);
  const cursorWeek = getWeekInfoFromStartIso(cursorWeekStartIso, new Date());
  const todayIso = toISODate(new Date());
  const planStartIso = todayIso >= cursorWeek.startIso && todayIso <= cursorWeek.endIso ? todayIso : cursorWeek.startIso;

  const planInsert = {
    user_id: userId,
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
  const vm = await buildMealsForSlots(values, profile, userId, planTitleForRow(insertedRow), rangeStart, rangeEnd);

  safeSetLocalStorageItem(localPlanKey(userId, planId), JSON.stringify(vm));
  safeSetLocalStorageItem(localLastPlanKey(userId), planId);

  const merged = existingPlans.concat(insertedRow).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const planIndex = merged.findIndex((r) => r.id === planId);
  return { plans: merged, planIndex, planId, plan: vm, selectedDay: defaultSelectedDay(insertedRow) };
}

export async function deletePlanAndSelectNext(userId: string, planId: string, plans: MealPlanRow[], cursorStartIso: string, cursorEndIso: string) {
  const { error: daysErr } = await supabase.from("meal_plan_days").delete().eq("meal_plan_id", planId);
  if (daysErr) throw daysErr;
  const { error: planErr } = await supabase.from("meal_plans").delete().eq("id", planId).eq("user_id", userId);
  if (planErr) throw planErr;

  safeRemoveLocalStorageItem(localPlanKey(userId, planId));
  safeRemoveLocalStorageItem(localLastPlanKey(userId));

  const remaining = plans.filter((p) => p.id !== planId);
  const selected = selectPlanForRange(userId, remaining, cursorStartIso, cursorEndIso);
  return { plans: remaining, ...selected };
}

export async function replaceMealInPlan(
  userId: string,
  planId: string,
  plan: MealPlanViewModel,
  planRow: Pick<MealPlanRow, "only_saved_recipes" | "only_new_recipes">,
  target: { date: string; mealType: MealType; recipeId: string },
) {
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
  const savedIdsArr = await fetchSavedRecipeIds(userId);
  const savedIds = new Set(savedIdsArr);

  const usedRecipes = new Set<string>();
  for (const d of plan.days) {
    for (const m of d.meals) {
      if (d.date === target.date && m.mealType === target.mealType && m.recipeId === target.recipeId) continue;
      usedRecipes.add(String(m.recipeId));
    }
  }

  const { allergyAvoid, dietAvoid } = await buildRestrictionKeywordSets(profile);
  const exclude = new Set<string>(usedRecipes);
  if (planRow.only_new_recipes) for (const id of savedIds) exclude.add(id);
  const newPool = planRow.only_saved_recipes ? [] : await buildNewRecipePool(allergyAvoid, dietAvoid, 80, exclude);

  const mealCache = new Map<string, Awaited<ReturnType<typeof resolveMealWithCost>>>();

  async function getCached(mealId: string) {
    if (mealCache.has(mealId)) return mealCache.get(mealId) ?? null;
    const r = await resolveMealWithCost(mealId);
    mealCache.set(mealId, r);
    return r;
  }

  async function pickOne() {
    const maxAttempts = 120;
    for (let i = 0; i < maxAttempts; i++) {
      const fromSaved = Boolean(planRow.only_saved_recipes) || (!planRow.only_new_recipes && savedIdsArr.length > 0 && Math.random() < 0.4);
      const source = fromSaved ? savedIdsArr : newPool;
      if (!source.length) continue;
      const id = String(source[Math.floor(Math.random() * source.length)] ?? "");
      if (!id) continue;
      if (exclude.has(id)) continue;
      const resolved = await getCached(id);
      if (!resolved) continue;
      const c = Number(resolved.cost ?? 0);
      if (!Number.isFinite(c) || c <= 0) continue;
      if (c > available) continue;
      return resolved;
    }
    return null;
  }

  const picked = await pickOne();
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
  safeSetLocalStorageItem(localPlanKey(userId, planId), JSON.stringify(nextPlan));
  return nextPlan;
}
