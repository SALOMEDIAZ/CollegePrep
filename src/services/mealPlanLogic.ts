import { searchMealsByFirstLetter, type MealDbMeal } from "./api";
import type { ProfileRow } from "../types/profile";
import type {
  CreatePlanValues,
  MealPlanDay,
  MealPlanMeal,
  MealPlanRow,
  MealPlanViewModel,
  MealType,
  Weekday,
} from "../types/mealPlan";
import { computeMealCostWithIndex, getIngredientIndex, resolveMealWithCostUsingIndex } from "./ingredientPricing";

function startOfWeekMonday(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const mondayBased = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - mondayBased);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function fromISODate(s: string) {
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

export function weekdayFromDate(d: Date): Weekday {
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

export function shiftWeekStartIso(startIso: string, deltaWeeks: number) {
  return addDaysISO(startIso, deltaWeeks * 7);
}

export function findPlanIndexForRange(rows: MealPlanRow[], rangeStartIso: string, rangeEndIso: string) {
  let bestIdx = -1;
  let bestStart = "";
  let bestCreated = "";
  let bestId = "";
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    if (!(r.start_date <= rangeEndIso && r.end_date >= rangeStartIso)) continue;
    const start = String(r.start_date ?? "");
    const created = String(r.created_at ?? "");
    const id = String(r.id ?? "");
    const better =
      bestIdx < 0 ||
      start > bestStart ||
      (start === bestStart && created > bestCreated) ||
      (start === bestStart && created === bestCreated && id > bestId);
    if (!better) continue;
    bestIdx = i;
    bestStart = start;
    bestCreated = created;
    bestId = id;
  }
  return bestIdx;
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

export function buildRestrictionValues(profile: ProfileRow | null) {
  if (!profile) return [];
  const allergyValues = (Array.isArray(profile.allergies) ? profile.allergies : []).map((x) => String(x ?? ""));
  const dietKeys = dietKeysFromProfile(profile);
  return allergyValues.concat(dietKeys).map((x) => String(x ?? "").trim()).filter(Boolean);
}

export function buildAvoidKeywordSets(profile: ProfileRow | null, allergyKeywords: string[]) {
  if (!profile) return { allergyAvoid: new Set<string>(), dietAvoid: new Set<string>() };
  const restrictionValues = buildRestrictionValues(profile);
  const dietKeys = dietKeysFromProfile(profile);
  const combined = (Array.isArray(allergyKeywords) ? allergyKeywords : []).concat(fallbackDietKeywords(dietKeys));

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

type Rng = () => number;

function seedToUInt32(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number): Rng {
  let x = a >>> 0;
  return () => {
    x = (x + 0x6d2b79f5) >>> 0;
    let t = x;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed: string | null | undefined): Rng {
  if (!seed) return Math.random;
  return mulberry32(seedToUInt32(seed));
}

function sampleUniqueWithRng<T>(items: T[], count: number, rng: Rng) {
  if (count <= 0) return [];
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(count, arr.length));
}

async function buildNewRecipePool(
  allergyAvoid: Set<string>,
  dietAvoid: Set<string>,
  minCount: number,
  excludeIds: Set<string>,
  rng: Rng,
) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
  const pickedLetters = new Set<string>();
  const pool: MealDbMeal[] = [];
  const seen = new Set<string>();

  for (let round = 0; round < 10 && pool.length < minCount; round++) {
    const letters = sampleUniqueWithRng(
      alphabet.filter((l) => !pickedLetters.has(l)),
      3,
      rng,
    );
    if (!letters.length) break;
    letters.forEach((l) => pickedLetters.add(l));
    const lists = await Promise.all(letters.map((l) => searchMealsByFirstLetter(l)));
    for (const list of lists) {
      const sorted = list
        .slice()
        .sort((a, b) => String(a?.idMeal ?? "").localeCompare(String(b?.idMeal ?? "")));
      for (const m of sorted) {
        const id = String(m?.idMeal ?? "");
        if (!id) continue;
        if (excludeIds.has(id)) continue;
        if (seen.has(id)) continue;
        if (!mealAllowedWithSets(m, allergyAvoid, dietAvoid)) continue;
        seen.add(id);
        pool.push(m);
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

export async function buildMealsForSlots(args: {
  values: CreatePlanValues;
  savedIdsArr: string[];
  weekTitle: string;
  rangeStart: Date;
  rangeEnd: Date;
  avoid: { allergyAvoid: Set<string>; dietAvoid: Set<string> };
  seed?: string;
}) {
  const { values, savedIdsArr, weekTitle, rangeStart, rangeEnd, avoid, seed } = args;
  const rng = makeRng(seed);
  const savedIds = new Set(savedIdsArr);
  const slots = buildSelectedSlots(values, rangeStart, rangeEnd);
  const poolTarget = Math.min(70, Math.max(24, slots.length * 3));
  const newPoolPromise = values.onlySavedRecipes
    ? Promise.resolve([] as MealDbMeal[])
    : buildNewRecipePool(
        avoid.allergyAvoid,
        avoid.dietAvoid,
        poolTarget,
        values.onlyNewRecipes ? savedIds : new Set<string>(),
        rng,
      );
  const ingredientIndexPromise = getIngredientIndex();
  const [newPool, ingredientIndex] = await Promise.all([newPoolPromise, ingredientIndexPromise]);

  const usedRecipes = new Set<string>();
  const triedRecipes = new Set<string>();
  const computedNewCost = new Map<string, number>();
  const resolvedCache = new Map<
    string,
    Awaited<ReturnType<typeof resolveMealWithCostUsingIndex>> | undefined
  >();
  let remaining = values.budget;

  async function pickOne() {
    const maxAttempts = 45;
    for (let i = 0; i < maxAttempts; i++) {
      const fromSaved = values.onlySavedRecipes || (!values.onlyNewRecipes && savedIdsArr.length > 0 && rng() < 0.4);
      if (fromSaved) {
        if (!savedIdsArr.length) continue;
        const id = String(savedIdsArr[Math.floor(rng() * savedIdsArr.length)] ?? "");
        if (!id) continue;
        if (usedRecipes.has(id)) continue;
        if (triedRecipes.has(id)) continue;
        triedRecipes.add(id);
        const cached = resolvedCache.get(id);
        const resolved = cached !== undefined ? cached : await resolveMealWithCostUsingIndex(id, ingredientIndex);
        if (cached === undefined) resolvedCache.set(id, resolved ?? null);
        if (!resolved) continue;
        const c = Number(resolved.cost ?? 0);
        if (!Number.isFinite(c) || c <= 0) continue;
        if (c > remaining) continue;
        usedRecipes.add(id);
        remaining -= c;
        return resolved;
      }

      if (!newPool.length) continue;
      const meal = newPool[Math.floor(rng() * newPool.length)];
      const id = String(meal?.idMeal ?? "");
      if (!id) continue;
      if (usedRecipes.has(id)) continue;
      if (triedRecipes.has(id)) continue;
      triedRecipes.add(id);

      const cachedCost = computedNewCost.get(id);
      const cost = cachedCost !== undefined ? cachedCost : computeMealCostWithIndex(meal, ingredientIndex);
      if (cachedCost === undefined) computedNewCost.set(id, cost);
      if (!Number.isFinite(cost) || cost <= 0) continue;
      if (cost > remaining) continue;

      usedRecipes.add(id);
      remaining -= cost;
      return {
        recipeId: id,
        recipeName: String(meal.strMeal ?? id),
        recipeThumb: meal.strMealThumb ?? null,
        cost,
      };
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

export async function pickReplacementMeal(args: {
  savedIdsArr: string[];
  onlySavedRecipes: boolean;
  onlyNewRecipes: boolean;
  availableBudget: number;
  excludeIds: Set<string>;
  avoid: { allergyAvoid: Set<string>; dietAvoid: Set<string> };
}) {
  const { savedIdsArr, onlySavedRecipes, onlyNewRecipes, availableBudget, excludeIds, avoid } = args;
  const savedIds = new Set(savedIdsArr);

  const effectiveExclude = new Set<string>(excludeIds);
  if (onlyNewRecipes) for (const id of savedIds) effectiveExclude.add(id);

  const newPoolPromise = onlySavedRecipes
    ? Promise.resolve([] as MealDbMeal[])
    : buildNewRecipePool(avoid.allergyAvoid, avoid.dietAvoid, 18, effectiveExclude, Math.random);
  const ingredientIndexPromise = getIngredientIndex();
  const [newPool, ingredientIndex] = await Promise.all([newPoolPromise, ingredientIndexPromise]);

  const tried = new Set<string>();
  const computedNewCost = new Map<string, number>();
  const resolvedCache = new Map<
    string,
    Awaited<ReturnType<typeof resolveMealWithCostUsingIndex>> | undefined
  >();
  const maxAttempts = 80;
  for (let i = 0; i < maxAttempts; i++) {
    const canUseNew = !onlySavedRecipes && newPool.length > 0;
    const canUseSaved = !onlyNewRecipes && savedIdsArr.length > 0;
    const fromSaved = Boolean(onlySavedRecipes) || (canUseSaved && (!canUseNew || Math.random() < 0.2));
    if (fromSaved) {
      if (!savedIdsArr.length) continue;
      const id = String(savedIdsArr[Math.floor(Math.random() * savedIdsArr.length)] ?? "");
      if (!id) continue;
      if (effectiveExclude.has(id)) continue;
      if (tried.has(id)) continue;
      tried.add(id);
      const cached = resolvedCache.get(id);
      const resolved = cached !== undefined ? cached : await resolveMealWithCostUsingIndex(id, ingredientIndex);
      if (cached === undefined) resolvedCache.set(id, resolved ?? null);
      if (!resolved) continue;
      const c = Number(resolved.cost ?? 0);
      if (!Number.isFinite(c) || c <= 0) continue;
      if (c > availableBudget) continue;
      return resolved;
    }

    if (!newPool.length) continue;
    const meal = newPool[Math.floor(Math.random() * newPool.length)];
    const id = String(meal?.idMeal ?? "");
    if (!id) continue;
    if (effectiveExclude.has(id)) continue;
    if (tried.has(id)) continue;
    tried.add(id);

    const cachedCost = computedNewCost.get(id);
    const cost = cachedCost !== undefined ? cachedCost : computeMealCostWithIndex(meal, ingredientIndex);
    if (cachedCost === undefined) computedNewCost.set(id, cost);
    if (!Number.isFinite(cost) || cost <= 0) continue;
    if (cost > availableBudget) continue;

    return {
      recipeId: id,
      recipeName: String(meal.strMeal ?? id),
      recipeThumb: meal.strMealThumb ?? null,
      cost,
    };
  }

  return null;
}
