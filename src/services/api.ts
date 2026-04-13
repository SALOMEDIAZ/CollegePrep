import supabase from "./supabaseClient";

export type MealDbMeal = {
  idMeal: string;
  strMeal: string | null;
  strCategory: string | null;
  strArea: string | null;
  strInstructions: string | null;
  strMealThumb: string | null;
  strYoutube: string | null;
  strSource: string | null;
  [k: string]: unknown;
};

type MealDbSearchResponse = { meals: MealDbMeal[] | null };

const MEALDB_API_KEY = import.meta.env.VITE_MEALDB_API_KEY ?? "1";
const MEALDB_BASE = `https://www.themealdb.com/api/json/v1/${MEALDB_API_KEY}`;
const CAN_WRITE_CACHE =
  String(import.meta.env.VITE_SUPABASE_CACHE_WRITE ?? "false").toLowerCase() ===
  "true";

async function mealDbGet<T>(path: string, params: Record<string, string>) {
  const u = new URL(`${MEALDB_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u.toString(), { method: "GET" });
  if (!r.ok)
    throw new Error(`TheMealDB request failed: ${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}

async function getCachedMealById(id: string): Promise<MealDbMeal | null> {
  const { data, error } = await supabase
    .from("recipes_cache")
    .select("raw")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  const raw = (data as { raw?: unknown } | null)?.raw;
  if (!raw || typeof raw !== "object") return null;
  const meal = raw as MealDbMeal;
  return meal?.idMeal ? meal : null;
}

async function upsertCachedMeal(meal: MealDbMeal) {
  if (!CAN_WRITE_CACHE) return;
  await supabase.from("recipes_cache").upsert(
    {
      id: meal.idMeal,
      raw: meal,
      cached_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
}

export async function getMealById(id: string): Promise<MealDbMeal | null> {
  const cached = await getCachedMealById(id);
  if (cached) return cached;

  const data = await mealDbGet<MealDbSearchResponse>("/lookup.php", { i: id });
  const meal = data.meals?.[0] ?? null;

  if (meal && CAN_WRITE_CACHE) {
    try {
      await upsertCachedMeal(meal);
    } catch {
      return meal;
    }
  }

  return meal;
}

export async function searchMealsByName(query: string): Promise<MealDbMeal[]> {
  const data = await mealDbGet<MealDbSearchResponse>("/search.php", {
    s: query,
  });
  const meals = data.meals ?? [];

  if (meals.length && CAN_WRITE_CACHE) {
    try {
      for (const m of meals) {
        if (m?.idMeal) await upsertCachedMeal(m);
      }
    } catch {
      return meals;
    }
  }

  return meals;
}

export async function getRandomMeal(): Promise<MealDbMeal | null> {
  const data = await mealDbGet<MealDbSearchResponse>("/random.php", {});
  return data.meals?.[0] ?? null;
}

export async function searchMealsByFirstLetter(
  letter: string,
): Promise<MealDbMeal[]> {
  const l = (letter || "").trim().slice(0, 1).toLowerCase();
  if (!/^[a-z]$/.test(l)) return [];
  const data = await mealDbGet<MealDbSearchResponse>("/search.php", { f: l });
  return data.meals ?? [];
}
