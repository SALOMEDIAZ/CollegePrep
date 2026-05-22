import { searchMealsByFirstLetter, type MealDbMeal } from "./api";
import type { ProfileRow } from "../types/profile";
// importamos dependencias
import type {
  CreatePlanValues,
  // paso del codigo
  MealPlanDay,
  MealPlanMeal,
  // paso del codigo
  MealPlanRow,
  MealPlanViewModel,
  // paso del codigo
  MealType,
  Weekday,
// paso del codigo
} from "../types/mealPlan";
import { computeMealCostWithIndex, getIngredientIndex, resolveMealWithCostUsingIndex } from "./ingredientPricing";

function startOfWeekMonday(d: Date) {
  const x = new Date(d);
  // paso del codigo
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  // variable
  const mondayBased = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - mondayBased);
  // retorno
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  // paso del codigo
  x.setDate(x.getDate() + n);
  return x;
// paso del codigo
}

export function toISODate(d: Date) {
  const y = d.getFullYear();
  // variable
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  // retorno
  return `${y}-${m}-${dd}`;
}

export function fromISODate(s: string) {
  const [y, m, d] = s.split("-").map((x) => Number(x));
  // variable
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setHours(0, 0, 0, 0);
  // retorno
  return dt;
}

export function addDaysISO(iso: string, delta: number) {
  const dt = fromISODate(iso);
  // paso del codigo
  dt.setDate(dt.getDate() + delta);
  return toISODate(dt);
// paso del codigo
}

export function formatDayTitle(iso: string) {
  const dt = fromISODate(iso);
  // variable
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(dt);
  const md = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(dt);
  // retorno
  return `${wd}, ${md}`;
}

function formatWeekTitle(start: Date, end: Date) {
  const m = new Intl.DateTimeFormat("en-US", { month: "short" });
  // retorno
  return `Next week, ${m.format(start)} ${start.getDate()}-${end.getDate()}`;
}

function weekLabelForRange(start: Date, end: Date, now = new Date()) {
  const todayIso = toISODate(now);
  // variable
  const s = toISODate(start);
  const e = toISODate(end);
  // retorno
  return todayIso >= s && todayIso <= e ? "This week" : "Week";
}

function formatWeekTitleWithLabel(start: Date, end: Date, label: string) {
  const m = new Intl.DateTimeFormat("en-US", { month: "short" });
  // retorno
  return `${label}, ${m.format(start)} ${start.getDate()}-${end.getDate()}`;
}

export function getWeekInfoForDate(now = new Date(), offsetWeeks = 0) {
  const base = startOfWeekMonday(now);
  // variable
  const start = addDays(base, offsetWeeks * 7);
  const end = addDays(start, 6);
  // variable
  const label = weekLabelForRange(start, end, now);
  return {
    // paso del codigo
    start,
    end,
    // paso del codigo
    startIso: toISODate(start),
    endIso: toISODate(end),
    // paso del codigo
    title: formatWeekTitleWithLabel(start, end, label),
  };
// paso del codigo
}

export function getWeekInfoFromStartIso(startIso: string, now = new Date()) {
  const start = fromISODate(startIso);
  // variable
  const end = addDays(start, 6);
  const label = weekLabelForRange(start, end, now);
  // retorno
  return {
    start,
    // paso del codigo
    end,
    startIso: toISODate(start),
    // paso del codigo
    endIso: toISODate(end),
    title: formatWeekTitleWithLabel(start, end, label),
  // paso del codigo
  };
}

export function getNextWeekInfo(now = new Date()) {
  const base = getWeekInfoForDate(now, 1);
  // retorno
  return { ...base, title: formatWeekTitle(base.start, base.end) };
}

export function planTitleForRow(row: MealPlanRow) {
  const s = new Date(row.start_date);
  // variable
  const e = new Date(row.end_date);
  const label = (() => {
    // variable
    const now = new Date();
    if (now >= new Date(row.start_date) && now <= new Date(row.end_date)) return "This week";
    // retorno
    return "Week";
  })();
  // variable
  const m = new Intl.DateTimeFormat("en-US", { month: "short" });
  return `${label}, ${m.format(s)} ${s.getDate()}-${e.getDate()}`;
// paso del codigo
}

export function weekdayFromDate(d: Date): Weekday {
  const map: Weekday[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  // variable
  const x = map[d.getDay()];
  return x === "Sun" ? "Sun" : x;
// paso del codigo
}

export function defaultSelectedDay(row: MealPlanRow) {
  const now = new Date();
  // variable
  const s = new Date(row.start_date);
  const e = new Date(row.end_date);
  // condicion
  if (now >= s && now <= e) return toISODate(now);
  return row.start_date;
// paso del codigo
}

export function shiftWeekStartIso(startIso: string, deltaWeeks: number) {
  return addDaysISO(startIso, deltaWeeks * 7);
// paso del codigo
}

export function findPlanIndexForRange(rows: MealPlanRow[], rangeStartIso: string, rangeEndIso: string) {
  let bestIdx = -1;
  // variable
  let bestStart = "";
  let bestCreated = "";
  // variable
  let bestId = "";
  for (let i = 0; i < rows.length; i++) {
    // variable
    const r = rows[i];
    if (!r) continue;
    // condicion
    if (!(r.start_date <= rangeEndIso && r.end_date >= rangeStartIso)) continue;
    const start = String(r.start_date ?? "");
    // variable
    const created = String(r.created_at ?? "");
    const id = String(r.id ?? "");
    // variable
    const better =
      bestIdx < 0 ||
      // paso del codigo
      start > bestStart ||
      (start === bestStart && created > bestCreated) ||
      // paso del codigo
      (start === bestStart && created === bestCreated && id > bestId);
    if (!better) continue;
    // paso del codigo
    bestIdx = i;
    bestStart = start;
    // paso del codigo
    bestCreated = created;
    bestId = id;
  // paso del codigo
  }
  return bestIdx;
// paso del codigo
}

function norm(s: string) {
  return s
    // paso del codigo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // paso del codigo
    .toLowerCase()
    .trim()
    // paso del codigo
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    // paso del codigo
    .replace(/\s+/g, " ")
    .trim();
// paso del codigo
}

function dietKeysFromProfile(profile: ProfileRow | null) {
  if (!profile) return [];
  // variable
  const keys: string[] = [];
  if (profile.vegan) keys.push("vegan");
  // paso del codigo
  else if (profile.vegetarian) keys.push("vegetarian");
  if (profile.gluten_free) keys.push("gluten_free", "gluten");
  // condicion
  if (profile.lactose_free) keys.push("lactose_free", "lactose");
  return keys;
// paso del codigo
}

function fallbackDietKeywords(dietKeys: string[]) {
  const wantsVeg = dietKeys.includes("vegan") || dietKeys.includes("vegetarian");
  // condicion
  if (!wantsVeg) return [];
  const baseNoMeat = ["meat", "beef", "pork", "chicken", "turkey", "lamb", "fish", "seafood", "shrimp"];
  // variable
  const veganExtras = ["egg", "milk", "cheese", "butter", "cream", "yogurt", "honey"];
  return dietKeys.includes("vegan") ? baseNoMeat.concat(veganExtras) : baseNoMeat;
// paso del codigo
}

export function buildRestrictionValues(profile: ProfileRow | null) {
  if (!profile) return [];
  // variable
  const allergyValues = (Array.isArray(profile.allergies) ? profile.allergies : []).map((x) => String(x ?? ""));
  const dietKeys = dietKeysFromProfile(profile);
  // retorno
  return allergyValues.concat(dietKeys).map((x) => String(x ?? "").trim()).filter(Boolean);
}

export function buildAvoidKeywordSets(profile: ProfileRow | null, allergyKeywords: string[]) {
  if (!profile) return { allergyAvoid: new Set<string>(), dietAvoid: new Set<string>() };
  // variable
  const restrictionValues = buildRestrictionValues(profile);
  const dietKeys = dietKeysFromProfile(profile);
  // variable
  const combined = (Array.isArray(allergyKeywords) ? allergyKeywords : []).concat(fallbackDietKeywords(dietKeys));

  const allergyAvoid = new Set<string>();
  for (const v of restrictionValues) {
    // variable
    const n = norm(String(v));
    if (n) allergyAvoid.add(n);
  // paso del codigo
  }
  for (const kw of combined) {
    // variable
    const n = norm(String(kw));
    if (n) allergyAvoid.add(n);
  // paso del codigo
  }

  return { allergyAvoid, dietAvoid: new Set<string>() };
}

function matchesAnyKeyword(text: string, keywords: Set<string>) {
  if (!keywords.size) return false;
  // variable
  const t = norm(text);
  if (!t) return false;
  // paso del codigo
  for (const k of keywords) {
    if (!k) continue;
    // condicion
    if (t === k) return true;
    if (t.includes(k)) return true;
  // paso del codigo
  }
  return false;
// paso del codigo
}

function extractMealIngredientNames(meal: MealDbMeal) {
  const out: string[] = [];
  // paso del codigo
  for (let i = 1; i <= 20; i++) {
    const k = `strIngredient${i}`;
    // variable
    const v = String((meal as unknown as Record<string, unknown>)[k] ?? "").trim();
    if (v) out.push(v);
  // paso del codigo
  }
  return out;
// paso del codigo
}

function mealAllowedWithSets(meal: MealDbMeal, allergyAvoid: Set<string>, dietAvoid: Set<string>) {
  const ingredients = extractMealIngredientNames(meal);
  // paso del codigo
  for (const ing of ingredients) {
    if (matchesAnyKeyword(ing, allergyAvoid)) return false;
    // condicion
    if (matchesAnyKeyword(ing, dietAvoid)) return false;
  }
  // variable
  const title = String(meal.strMeal ?? "");
  const category = String(meal.strCategory ?? "");
  // condicion
  if (matchesAnyKeyword(title, allergyAvoid)) return false;
  if (matchesAnyKeyword(title, dietAvoid)) return false;
  // condicion
  if (matchesAnyKeyword(category, allergyAvoid)) return false;
  if (matchesAnyKeyword(category, dietAvoid)) return false;
  // retorno
  return true;
}

type Rng = () => number;

function seedToUInt32(seed: string) {
  let h = 2166136261;
  // paso del codigo
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    // paso del codigo
    h = Math.imul(h, 16777619);
  }
  // retorno
  return h >>> 0;
}

function mulberry32(a: number): Rng {
  let x = a >>> 0;
  // retorno
  return () => {
    x = (x + 0x6d2b79f5) >>> 0;
    // variable
    let t = x;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    // paso del codigo
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  // paso del codigo
  };
}

function makeRng(seed: string | null | undefined): Rng {
  if (!seed) return Math.random;
  // retorno
  return mulberry32(seedToUInt32(seed));
}

function sampleUniqueWithRng<T>(items: T[], count: number, rng: Rng) {
  if (count <= 0) return [];
  // variable
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    // variable
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  // paso del codigo
  }
  return arr.slice(0, Math.min(count, arr.length));
// paso del codigo
}

async function buildNewRecipePool(
  allergyAvoid: Set<string>,
  // paso del codigo
  dietAvoid: Set<string>,
  minCount: number,
  // paso del codigo
  excludeIds: Set<string>,
  rng: Rng,
// paso del codigo
) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
  // variable
  const pickedLetters = new Set<string>();
  const pool: MealDbMeal[] = [];
  // variable
  const seen = new Set<string>();

  for (let round = 0; round < 10 && pool.length < minCount; round++) {
    const letters = sampleUniqueWithRng(
      // paso del codigo
      alphabet.filter((l) => !pickedLetters.has(l)),
      3,
      // paso del codigo
      rng,
    );
    // condicion
    if (!letters.length) break;
    letters.forEach((l) => pickedLetters.add(l));
    // variable
    const lists = await Promise.all(letters.map((l) => searchMealsByFirstLetter(l)));
    for (const list of lists) {
      // variable
      const sorted = list
        .slice()
        // paso del codigo
        .sort((a, b) => String(a?.idMeal ?? "").localeCompare(String(b?.idMeal ?? "")));
      for (const m of sorted) {
        // variable
        const id = String(m?.idMeal ?? "");
        if (!id) continue;
        // condicion
        if (excludeIds.has(id)) continue;
        if (seen.has(id)) continue;
        // condicion
        if (!mealAllowedWithSets(m, allergyAvoid, dietAvoid)) continue;
        seen.add(id);
        // paso del codigo
        pool.push(m);
        if (pool.length >= minCount) break;
      // paso del codigo
      }
      if (pool.length >= minCount) break;
    // paso del codigo
    }
  }

  return pool;
}

function buildPlanViewModel(title: string, budget: number, days: MealPlanDay[]) {
  const used = days.flatMap((d) => d.meals).reduce((acc, m) => acc + Number(m.cost ?? 0), 0);
  // variable
  const vm: MealPlanViewModel = { title, budget, used, days };
  return vm;
// paso del codigo
}

function buildSelectedSlots(values: CreatePlanValues, rangeStart: Date, rangeEnd: Date) {
  const slots: Array<{ date: string; weekday: Weekday; mealType: MealType }> = [];
  // variable
  const days = Math.max(0, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000)));
  for (let i = 0; i <= days; i++) {
    // variable
    const d = addDays(rangeStart, i);
    const wd = weekdayFromDate(d);
    // variable
    const sel = values.selections[wd];
    (["breakfast", "lunch", "dinner"] as MealType[]).forEach((mt) => {
      // condicion
      if (sel[mt]) slots.push({ date: toISODate(d), weekday: wd, mealType: mt });
    });
  // paso del codigo
  }
  return slots;
// paso del codigo
}

export async function buildMealsForSlots(args: {
  values: CreatePlanValues;
  // paso del codigo
  savedIdsArr: string[];
  weekTitle: string;
  // paso del codigo
  rangeStart: Date;
  rangeEnd: Date;
  // paso del codigo
  avoid: { allergyAvoid: Set<string>; dietAvoid: Set<string> };
  seed?: string;
// paso del codigo
}) {
  const { values, savedIdsArr, weekTitle, rangeStart, rangeEnd, avoid, seed } = args;
  // variable
  const rng = makeRng(seed);
  const savedIds = new Set(savedIdsArr);
  // variable
  const slots = buildSelectedSlots(values, rangeStart, rangeEnd);
  const poolTarget = Math.min(70, Math.max(24, slots.length * 3));
  // variable
  const newPoolPromise = values.onlySavedRecipes
    ? Promise.resolve([] as MealDbMeal[])
    // paso del codigo
    : buildNewRecipePool(
        avoid.allergyAvoid,
        // paso del codigo
        avoid.dietAvoid,
        poolTarget,
        // paso del codigo
        values.onlyNewRecipes ? savedIds : new Set<string>(),
        rng,
      // paso del codigo
      );
  const ingredientIndexPromise = getIngredientIndex();
  // variable
  const [newPool, ingredientIndex] = await Promise.all([newPoolPromise, ingredientIndexPromise]);

  const usedRecipes = new Set<string>();
  const triedRecipes = new Set<string>();
  // variable
  const computedNewCost = new Map<string, number>();
  const resolvedCache = new Map<
    // paso del codigo
    string,
    Awaited<ReturnType<typeof resolveMealWithCostUsingIndex>> | undefined
  // paso del codigo
  >();
  let remaining = values.budget;

  async function pickOne() {
    const maxAttempts = 45;
    // paso del codigo
    for (let i = 0; i < maxAttempts; i++) {
      const fromSaved = values.onlySavedRecipes || (!values.onlyNewRecipes && savedIdsArr.length > 0 && rng() < 0.4);
      // condicion
      if (fromSaved) {
        if (!savedIdsArr.length) continue;
        // variable
        const id = String(savedIdsArr[Math.floor(rng() * savedIdsArr.length)] ?? "");
        if (!id) continue;
        // condicion
        if (usedRecipes.has(id)) continue;
        if (triedRecipes.has(id)) continue;
        // paso del codigo
        triedRecipes.add(id);
        const cached = resolvedCache.get(id);
        // variable
        const resolved = cached !== undefined ? cached : await resolveMealWithCostUsingIndex(id, ingredientIndex);
        if (cached === undefined) resolvedCache.set(id, resolved ?? null);
        // condicion
        if (!resolved) continue;
        const c = Number(resolved.cost ?? 0);
        // condicion
        if (!Number.isFinite(c) || c <= 0) continue;
        if (c > remaining) continue;
        // paso del codigo
        usedRecipes.add(id);
        remaining -= c;
        // retorno
        return resolved;
      }

      if (!newPool.length) continue;
      const meal = newPool[Math.floor(rng() * newPool.length)];
      // variable
      const id = String(meal?.idMeal ?? "");
      if (!id) continue;
      // condicion
      if (usedRecipes.has(id)) continue;
      if (triedRecipes.has(id)) continue;
      // paso del codigo
      triedRecipes.add(id);

      const cachedCost = computedNewCost.get(id);
      const cost = cachedCost !== undefined ? cachedCost : computeMealCostWithIndex(meal, ingredientIndex);
      // condicion
      if (cachedCost === undefined) computedNewCost.set(id, cost);
      if (!Number.isFinite(cost) || cost <= 0) continue;
      // condicion
      if (cost > remaining) continue;

      usedRecipes.add(id);
      remaining -= cost;
      // retorno
      return {
        recipeId: id,
        // paso del codigo
        recipeName: String(meal.strMeal ?? id),
        recipeThumb: meal.strMealThumb ?? null,
        // paso del codigo
        cost,
      };
    // paso del codigo
    }
    return null;
  // paso del codigo
  }

  const dayMap = new Map<string, MealPlanDay>();
  for (const s of slots) {
    // condicion
    if (remaining <= 0) break;
    const picked = await pickOne();
    // condicion
    if (!picked) continue;
    const mealItem: MealPlanMeal = {
      // paso del codigo
      mealType: s.mealType,
      recipeId: picked.recipeId,
      // paso del codigo
      recipeName: picked.recipeName,
      recipeThumb: picked.recipeThumb,
      // paso del codigo
      cost: picked.cost,
    };
    // variable
    const key = s.date;
    const existing = dayMap.get(key);
    // condicion
    if (existing) {
      existing.meals.push(mealItem);
    // paso del codigo
    } else {
      dayMap.set(key, { date: s.date, weekday: s.weekday, meals: [mealItem] });
    // paso del codigo
    }
  }

  const days = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  return buildPlanViewModel(weekTitle, values.budget, days);
// paso del codigo
}

export async function pickReplacementMeal(args: {
  savedIdsArr: string[];
  // paso del codigo
  onlySavedRecipes: boolean;
  onlyNewRecipes: boolean;
  // paso del codigo
  availableBudget: number;
  excludeIds: Set<string>;
  // paso del codigo
  avoid: { allergyAvoid: Set<string>; dietAvoid: Set<string> };
}) {
  // variable
  const { savedIdsArr, onlySavedRecipes, onlyNewRecipes, availableBudget, excludeIds, avoid } = args;
  const savedIds = new Set(savedIdsArr);

  const effectiveExclude = new Set<string>(excludeIds);
  if (onlyNewRecipes) for (const id of savedIds) effectiveExclude.add(id);

  const newPoolPromise = onlySavedRecipes
    ? Promise.resolve([] as MealDbMeal[])
    // paso del codigo
    : buildNewRecipePool(avoid.allergyAvoid, avoid.dietAvoid, 18, effectiveExclude, Math.random);
  const ingredientIndexPromise = getIngredientIndex();
  // variable
  const [newPool, ingredientIndex] = await Promise.all([newPoolPromise, ingredientIndexPromise]);

  const tried = new Set<string>();
  const computedNewCost = new Map<string, number>();
  // variable
  const resolvedCache = new Map<
    string,
    // paso del codigo
    Awaited<ReturnType<typeof resolveMealWithCostUsingIndex>> | undefined
  >();
  // variable
  const maxAttempts = 80;
  for (let i = 0; i < maxAttempts; i++) {
    // variable
    const canUseNew = !onlySavedRecipes && newPool.length > 0;
    const canUseSaved = !onlyNewRecipes && savedIdsArr.length > 0;
    // variable
    const fromSaved = Boolean(onlySavedRecipes) || (canUseSaved && (!canUseNew || Math.random() < 0.2));
    if (fromSaved) {
      // condicion
      if (!savedIdsArr.length) continue;
      const id = String(savedIdsArr[Math.floor(Math.random() * savedIdsArr.length)] ?? "");
      // condicion
      if (!id) continue;
      if (effectiveExclude.has(id)) continue;
      // condicion
      if (tried.has(id)) continue;
      tried.add(id);
      // variable
      const cached = resolvedCache.get(id);
      const resolved = cached !== undefined ? cached : await resolveMealWithCostUsingIndex(id, ingredientIndex);
      // condicion
      if (cached === undefined) resolvedCache.set(id, resolved ?? null);
      if (!resolved) continue;
      // variable
      const c = Number(resolved.cost ?? 0);
      if (!Number.isFinite(c) || c <= 0) continue;
      // condicion
      if (c > availableBudget) continue;
      return resolved;
    // paso del codigo
    }

    if (!newPool.length) continue;
    const meal = newPool[Math.floor(Math.random() * newPool.length)];
    // variable
    const id = String(meal?.idMeal ?? "");
    if (!id) continue;
    // condicion
    if (effectiveExclude.has(id)) continue;
    if (tried.has(id)) continue;
    // paso del codigo
    tried.add(id);

    const cachedCost = computedNewCost.get(id);
    const cost = cachedCost !== undefined ? cachedCost : computeMealCostWithIndex(meal, ingredientIndex);
    // condicion
    if (cachedCost === undefined) computedNewCost.set(id, cost);
    if (!Number.isFinite(cost) || cost <= 0) continue;
    // condicion
    if (cost > availableBudget) continue;

    return {
      recipeId: id,
      // paso del codigo
      recipeName: String(meal.strMeal ?? id),
      recipeThumb: meal.strMealThumb ?? null,
      // paso del codigo
      cost,
    };
  // paso del codigo
  }

  return null;
}
