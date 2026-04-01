import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import supabase from "../../services/supabaseClient";
import { getMealById, type MealDbMeal } from "../../services/api";
import "../../styles/recipeCard.css";

type RecipeCardProps =
  | { meal: MealDbMeal; mealId?: never }
  | { meal?: never; mealId: string };

type IngredientRow = { id: number; name: string | null; price: number | string | null };
type IngredientIndex = {
  byNorm: Map<string, number>;
  list: Array<{ id: number; name: string; norm: string }>;
  priceById: Map<number, number>;
};

let ingredientIndexPromise: Promise<IngredientIndex> | null = null;

function normIngredientName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const assetIcon = (f: string) => `/assets/images-icons/${encodeURIComponent(f)}`;
const ICON_PREP = assetIcon("PrepTime.svg");
const ICON_COOK = assetIcon("CookingTime.svg");
const ICON_COST = assetIcon("Budget.svg");

async function getIngredientIndex(): Promise<IngredientIndex> {
  if (ingredientIndexPromise) return ingredientIndexPromise;
  ingredientIndexPromise = (async () => {
    const { data, error } = await supabase.from("ingredients").select("id,name,price");
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
    return { byNorm, list, priceById };
  })();
  return ingredientIndexPromise;
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

function extractMinutesFromText(text: string) {
  const minutes: number[] = [];

  const add = (n: number) => {
    if (Number.isFinite(n) && n > 0) minutes.push(n);
  };

  const rangeMin = /(\d+)\s*[-–]\s*(\d+)\s*(?:mins?|minutes?)\b/gi;
  for (const m of text.matchAll(rangeMin)) add(Number(m[2]));

  const singleMin = /(\d+)\s*(?:mins?|minutes?)\b/gi;
  for (const m of text.matchAll(singleMin)) add(Number(m[1]));

  const singleHr = /(\d+)\s*(?:h|hr|hrs|hour|hours)\b/gi;
  for (const m of text.matchAll(singleHr)) add(Number(m[1]) * 60);

  return minutes;
}

function getTimeLabels(meal: MealDbMeal | null) {
  const tagsRaw = meal ? String((meal as unknown as { strTags?: unknown }).strTags ?? "") : "";
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const noCook = tags.includes("nocook");

  const instructions = meal ? String(meal.strInstructions ?? "") : "";
  const times = instructions ? extractMinutesFromText(instructions) : [];

  const fallbackPrep = "10 minutes to prep";
  const fallbackCook = noCook ? "No cooking time" : "Cooking time varies";

  if (!times.length) return { prepLabel: fallbackPrep, cookLabel: fallbackCook };

  const min = Math.min(...times);
  const max = Math.max(...times);

  if (noCook) return { prepLabel: `${min} minutes to prep`, cookLabel: "No cooking time" };

  if (times.length === 1) {
    if (min <= 20) return { prepLabel: `${min} minutes to prep`, cookLabel: fallbackCook };
    return { prepLabel: fallbackPrep, cookLabel: `${min} minutes cooking time` };
  }

  if (min === max) return { prepLabel: `${min} minutes to prep`, cookLabel: `${max} minutes cooking time` };
  return { prepLabel: `${min} minutes to prep`, cookLabel: `${max} minutes cooking time` };
}

function useMeal(mealProp?: MealDbMeal, mealIdProp?: string) {
  const [meal, setMeal] = useState<MealDbMeal | null>(mealProp ?? null);
  const [loading, setLoading] = useState(!mealProp);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function run() {
      if (mealProp) {
        setMeal(mealProp);
        setLoading(false);
        setError(null);
        return;
      }
      if (!mealIdProp) {
        setMeal(null);
        setLoading(false);
        setError("Missing meal id");
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const m = await getMealById(mealIdProp);
        if (!alive) return;
        setMeal(m);
        if (!m) setError("Recipe not found");
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
        setMeal(null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [mealProp, mealIdProp]);

  return { meal, loading, error };
}

function extractIngredientNames(meal: MealDbMeal | null) {
  const names: string[] = [];
  if (!meal) return names;
  for (let i = 1; i <= 20; i++) {
    const k = `strIngredient${i}` as keyof MealDbMeal;
    const v = String(meal[k] ?? "").trim();
    if (v) names.push(v);
  }
  return names;
}

function useMealCost(meal: MealDbMeal | null) {
  const ingredientNames = useMemo(() => extractIngredientNames(meal), [meal]);
  const [cost, setCost] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!ingredientNames.length) {
        setCost(0);
        setPricingError(null);
        return;
      }
      try {
        setLoading(true);
        setPricingError(null);
        const index = await getIngredientIndex();
        const uniq = Array.from(new Set(ingredientNames.map((n) => String(n).trim()))).filter(Boolean);
        const pickedIds = uniq
          .map((n) => pickBestIngredientId(n, index))
          .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
        const uniqueIds = Array.from(new Set(pickedIds));
        const total = uniqueIds.reduce((acc, id) => acc + Number(index.priceById.get(id) ?? 0), 0);
        if (!alive) return;
        setCost(total);
      } catch (e) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : String(e);
        setPricingError(msg);
        setCost(null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [ingredientNames]);

  return { cost, loading, pricingError };
}

const fmtCop = (n: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(n));

export default function RecipeCard(props: RecipeCardProps) {
  const { meal, loading, error } = useMeal("meal" in props ? props.meal : undefined, "mealId" in props ? props.mealId : undefined);
  const { cost, loading: costLoading, pricingError } = useMealCost(meal);

  if (loading) return <article className="recipe-card"><div className="recipe-card__body"><p>Loading…</p></div></article>;
  if (error) return <article className="recipe-card"><div className="recipe-card__body"><p>{error}</p></div></article>;
  if (!meal) return <article className="recipe-card"><div className="recipe-card__body"><p>Recipe not found</p></div></article>;

  const href = `/recipes/${meal.idMeal}`;
  const title = meal.strMeal || meal.idMeal;
  const img = meal.strMealThumb || "";
  const { prepLabel, cookLabel } = getTimeLabels(meal);

  return (
    <Link to={href} className="recipe-card recipe-card--link" aria-label={`Open ${title}`}>
      {img ? (
        <div className="recipe-card__media">
          <span className="recipe-card__currency">COP</span>
          <img src={img} alt={title} className="recipe-card__img" />
        </div>
      ) : (
        <div className="recipe-card__media">
          <span className="recipe-card__currency">COP</span>
        </div>
      )}
      <div className="recipe-card__body">
        <h3 className="recipe-card__title">{title}</h3>
        <div className="recipe-card__meta">
          <div className="recipe-card__metaRow">
            <span className="recipe-pill">
              <img className="recipe-pill__icon" src={ICON_PREP} alt="" aria-hidden="true" />
              {prepLabel}
            </span>
            <span className="recipe-pill">
              <img className="recipe-pill__icon" src={ICON_COOK} alt="" aria-hidden="true" />
              {cookLabel}
            </span>
          </div>
          <div className="recipe-card__metaRow">
            <span className="recipe-pill recipe-pill--cost">
              <img className="recipe-pill__icon" src={ICON_COST} alt="" aria-hidden="true" />
              {costLoading
                ? "Calculating…"
                : pricingError
                  ? "Pricing unavailable"
                  : `Total cost: ${fmtCop(Number(cost || 0))}`}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
