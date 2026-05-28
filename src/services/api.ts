// esto es la estructura que devuelve la api de TheMealDB para cada receta
export type MealDbMeal = {
  idMeal: string;
  // paso del codigo
  strMeal: string | null;
  strCategory: string | null;
  // paso del codigo
  strArea: string | null;
  strInstructions: string | null;
  // paso del codigo
  strMealThumb: string | null;
  strYoutube: string | null;
  // paso del codigo
  strSource: string | null;
  [k: string]: unknown;
// paso del codigo
};

type MealDbSearchResponse = { meals: MealDbMeal[] | null };

// configuración de la api de TheMealDB
const MEALDB_API_KEY = import.meta.env.VITE_MEALDB_API_KEY ?? "1";
const MEALDB_BASE = `https://www.themealdb.com/api/json/v1/${MEALDB_API_KEY}`;

// cache en memoria por 5 minutos para no repetir fetch
const MEALDB_CACHE_TTL_MS = 5 * 60 * 1000;
const mealDbCache = new Map<string, { atMs: number; data: unknown }>();
// variable
// si dos componentes piden lo mismo a la vez, reutilizamos la misma promesa
const mealDbInFlight = new Map<string, Promise<unknown>>();

// función auxiliar para hacer llamadas a la api
async function mealDbGet<T>(path: string, params: Record<string, string>) {
  const u = new URL(`${MEALDB_BASE}${path}`);
  // paso del codigo
  // agregamos query params como s= o i=
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const key = u.toString();
  // variable
  const cached = mealDbCache.get(key);
  if (cached && Date.now() - cached.atMs <= MEALDB_CACHE_TTL_MS) return cached.data as T;

  const inFlight = mealDbInFlight.get(key);
  if (inFlight) return (await inFlight) as T;

  const p = (async () => {
    const r = await fetch(key, { method: "GET" });
    // condicion
    if (!r.ok) throw new Error(`TheMealDB request failed: ${r.status} ${r.statusText}`);
    return (await r.json()) as T;
  // paso del codigo
  })();
  mealDbInFlight.set(key, p as Promise<unknown>);
  // paso del codigo
  try {
    const data = await p;
    // paso del codigo
    mealDbCache.set(key, { atMs: Date.now(), data });
    return data;
  // paso del codigo
  } finally {
    mealDbInFlight.delete(key);
  // paso del codigo
  }
}

// trae todos los detalles de una receta por su id
export async function getMealById(id: string): Promise<MealDbMeal | null> {
  const data = await mealDbGet<MealDbSearchResponse>("/lookup.php", { i: id });
  // retorno
  return data.meals?.[0] ?? null;
}

// busca recetas por nombre
export async function searchMealsByName(query: string): Promise<MealDbMeal[]> {
  const data = await mealDbGet<MealDbSearchResponse>("/search.php", {
    // paso del codigo
    s: query,
  });
  // retorno
  return data.meals ?? [];
}

// trae una receta aleatoria
export async function getRandomMeal(): Promise<MealDbMeal | null> {
  const data = await mealDbGet<MealDbSearchResponse>("/random.php", {});
  // retorno
  return data.meals?.[0] ?? null;
}

// busca todas las recetas que empiezan con una letra específica
export async function searchMealsByFirstLetter(
  letter: string,
// paso del codigo
): Promise<MealDbMeal[]> {
  const l = (letter || "").trim().slice(0, 1).toLowerCase();
  // condicion
  if (!/^[a-z]$/.test(l)) return [];
  const data = await mealDbGet<MealDbSearchResponse>("/search.php", { f: l });
  // retorno
  return data.meals ?? [];
}
