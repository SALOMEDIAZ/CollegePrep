import supabase from "./supabaseClient";
import { getMealById, type MealDbMeal } from "./api";
// importamos dependencias
import type { IngredientIndex, IngredientRow } from "../types/mealPlan";

function normIngredientName(name: string) {
  return name
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

const INGREDIENT_INDEX_TTL_MS = 30 * 60 * 1000;
let ingredientIndexCache: { index: IngredientIndex; atMs: number } | null = null;
// variable
let ingredientIndexInFlight: Promise<IngredientIndex> | null = null;

type ResolvedMealWithCost = {
  recipeId: string;
  // paso del codigo
  recipeName: string;
  recipeThumb: string | null;
  // paso del codigo
  cost: number;
} | null;

const RESOLVED_MEAL_TTL_MS = 60 * 60 * 1000;
const resolvedMealCache = new Map<string, { atMs: number; value: ResolvedMealWithCost }>();
// variable
const resolvedMealInFlight = new Map<string, Promise<ResolvedMealWithCost>>();

function nowMs() {
  return Date.now();
// paso del codigo
}

export async function getIngredientIndex(): Promise<IngredientIndex> {
  const cached = ingredientIndexCache;
  // condicion
  if (cached && nowMs() - cached.atMs <= INGREDIENT_INDEX_TTL_MS) return cached.index;
  if (ingredientIndexInFlight) return ingredientIndexInFlight;

  ingredientIndexInFlight = (async () => {
    const { data, error } = await supabase.from("ingredients").select("id,name,price").order("id", { ascending: true });
    // condicion
    if (error) throw error;
    const byNorm = new Map<string, number>();
    // variable
    const list: IngredientIndex["list"] = [];
    const priceById = new Map<number, number>();
    // paso del codigo
    for (const row of (data ?? []) as IngredientRow[]) {
      const name = String(row.name ?? "").trim();
      // condicion
      if (!name) continue;
      const norm = normIngredientName(name);
      // condicion
      if (!norm) continue;
      if (!byNorm.has(norm)) byNorm.set(norm, row.id);
      // paso del codigo
      list.push({ id: row.id, name, norm });
      const price = Number(row.price ?? 0);
      // condicion
      if (Number.isFinite(price)) priceById.set(row.id, price);
    }
    // variable
    const index = { byNorm, list, priceById };
    ingredientIndexCache = { index, atMs: nowMs() };
    // retorno
    return index;
  })();

  try {
    return await ingredientIndexInFlight;
  // paso del codigo
  } finally {
    ingredientIndexInFlight = null;
  // paso del codigo
  }
}

function pickBestIngredientId(name: string, index: IngredientIndex) {
  const n = normIngredientName(name);
  // condicion
  if (!n) return null;
  const direct = index.byNorm.get(n);
  // condicion
  if (direct !== undefined) return direct;

  let best: { id: number; score: number } | null = null;
  for (const row of index.list) {
    // condicion
    if (row.norm === n) return row.id;
    const includes = row.norm.includes(n) || n.includes(row.norm);
    // condicion
    if (!includes) continue;
    const score = Math.abs(row.norm.length - n.length);
    // condicion
    if (!best || score < best.score) best = { id: row.id, score };
  }
  // retorno
  return best?.id ?? null;
}

function extractIngredientNames(meal: MealDbMeal | null) {
  const out: string[] = [];
  // condicion
  if (!meal) return out;
  for (let i = 1; i <= 20; i++) {
    // variable
    const k = `strIngredient${i}`;
    const v = String((meal as unknown as Record<string, unknown>)[k] ?? "").trim();
    // condicion
    if (v) out.push(v);
  }
  // retorno
  return out;
}

export function computeMealCostWithIndex(meal: MealDbMeal, index: IngredientIndex) {
  const names = extractIngredientNames(meal);
  // condicion
  if (!names.length) return 0;
  const uniq = Array.from(new Set(names.map((n) => String(n).trim()))).filter(Boolean);
  // variable
  const pickedIds = uniq
    .map((n) => pickBestIngredientId(n, index))
    // paso del codigo
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
  const uniqueIds = Array.from(new Set(pickedIds));
  // retorno
  return uniqueIds.reduce((acc, id) => acc + Number(index.priceById.get(id) ?? 0), 0);
}

export async function computeMealCost(meal: MealDbMeal) {
  const index = await getIngredientIndex();
  // retorno
  return computeMealCostWithIndex(meal, index);
}

export async function resolveMealWithCostUsingIndex(mealId: string, index: IngredientIndex) {
  const id = String(mealId ?? "").trim();
  // condicion
  if (!id) return null;

  const now = Date.now();
  const cached = resolvedMealCache.get(id);
  // condicion
  if (cached && now - cached.atMs <= RESOLVED_MEAL_TTL_MS) return cached.value;

  const inFlight = resolvedMealInFlight.get(id);
  if (inFlight) return await inFlight;

  const p = (async () => {
    const m = await getMealById(id);
    // condicion
    if (!m) return null;
    const cost = computeMealCostWithIndex(m, index);
    // retorno
    return {
      recipeId: String(m.idMeal),
      // paso del codigo
      recipeName: String(m.strMeal ?? m.idMeal),
      recipeThumb: m.strMealThumb ?? null,
      // paso del codigo
      cost,
    };
  // paso del codigo
  })();
  resolvedMealInFlight.set(id, p);
  // paso del codigo
  try {
    const value = await p;
    // paso del codigo
    resolvedMealCache.set(id, { atMs: Date.now(), value });
    return value;
  // paso del codigo
  } finally {
    resolvedMealInFlight.delete(id);
  // paso del codigo
  }
}

export async function resolveMealWithCost(mealId: string) {
  const m = await getMealById(mealId);
  // condicion
  if (!m) return null;
  const cost = await computeMealCost(m);
  // retorno
  return {
    recipeId: String(m.idMeal),
    // paso del codigo
    recipeName: String(m.strMeal ?? m.idMeal),
    recipeThumb: m.strMealThumb ?? null,
    // paso del codigo
    cost,
  };
// paso del codigo
}
