import supabase from "./supabaseClient";
import { getMealById, type MealDbMeal } from "./api";
import type { IngredientIndex, IngredientRow } from "../types/mealPlan";

function normIngredientName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const INGREDIENT_INDEX_TTL_MS = 30 * 60 * 1000;
let ingredientIndexCache: { index: IngredientIndex; atMs: number } | null = null;
let ingredientIndexInFlight: Promise<IngredientIndex> | null = null;

function nowMs() {
  return Date.now();
}

export async function getIngredientIndex(): Promise<IngredientIndex> {
  const cached = ingredientIndexCache;
  if (cached && nowMs() - cached.atMs <= INGREDIENT_INDEX_TTL_MS) return cached.index;
  if (ingredientIndexInFlight) return ingredientIndexInFlight;

  ingredientIndexInFlight = (async () => {
    const { data, error } = await supabase.from("ingredients").select("id,name,price").order("id", { ascending: true });
    if (error) throw error;
    const byNorm = new Map<string, number>();
    const list: IngredientIndex["list"] = [];
    const priceById = new Map<number, number>();
    for (const row of (data ?? []) as IngredientRow[]) {
      const name = String(row.name ?? "").trim();
      if (!name) continue;
      const norm = normIngredientName(name);
      if (!norm) continue;
      if (!byNorm.has(norm)) byNorm.set(norm, row.id);
      list.push({ id: row.id, name, norm });
      const price = Number(row.price ?? 0);
      if (Number.isFinite(price)) priceById.set(row.id, price);
    }
    const index = { byNorm, list, priceById };
    ingredientIndexCache = { index, atMs: nowMs() };
    return index;
  })();

  try {
    return await ingredientIndexInFlight;
  } finally {
    ingredientIndexInFlight = null;
  }
}

function pickBestIngredientId(name: string, index: IngredientIndex) {
  const n = normIngredientName(name);
  if (!n) return null;
  const direct = index.byNorm.get(n);
  if (direct !== undefined) return direct;

  let best: { id: number; score: number } | null = null;
  for (const row of index.list) {
    if (row.norm === n) return row.id;
    const includes = row.norm.includes(n) || n.includes(row.norm);
    if (!includes) continue;
    const score = Math.abs(row.norm.length - n.length);
    if (!best || score < best.score) best = { id: row.id, score };
  }
  return best?.id ?? null;
}

function extractIngredientNames(meal: MealDbMeal | null) {
  const out: string[] = [];
  if (!meal) return out;
  for (let i = 1; i <= 20; i++) {
    const k = `strIngredient${i}`;
    const v = String((meal as unknown as Record<string, unknown>)[k] ?? "").trim();
    if (v) out.push(v);
  }
  return out;
}

export function computeMealCostWithIndex(meal: MealDbMeal, index: IngredientIndex) {
  const names = extractIngredientNames(meal);
  if (!names.length) return 0;
  const uniq = Array.from(new Set(names.map((n) => String(n).trim()))).filter(Boolean);
  const pickedIds = uniq
    .map((n) => pickBestIngredientId(n, index))
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
  const uniqueIds = Array.from(new Set(pickedIds));
  return uniqueIds.reduce((acc, id) => acc + Number(index.priceById.get(id) ?? 0), 0);
}

export async function computeMealCost(meal: MealDbMeal) {
  const index = await getIngredientIndex();
  return computeMealCostWithIndex(meal, index);
}

export async function resolveMealWithCostUsingIndex(mealId: string, index: IngredientIndex) {
  const m = await getMealById(mealId);
  if (!m) return null;
  const cost = computeMealCostWithIndex(m, index);
  return {
    recipeId: String(m.idMeal),
    recipeName: String(m.strMeal ?? m.idMeal),
    recipeThumb: m.strMealThumb ?? null,
    cost,
  };
}

export async function resolveMealWithCost(mealId: string) {
  const m = await getMealById(mealId);
  if (!m) return null;
  const cost = await computeMealCost(m);
  return {
    recipeId: String(m.idMeal),
    recipeName: String(m.strMeal ?? m.idMeal),
    recipeThumb: m.strMealThumb ?? null,
    cost,
  };
}
