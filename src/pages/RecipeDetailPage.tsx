// pagina de detalle de una receta: ingredientes, costo, guardar favorito
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import supabase from "../services/supabaseClient";
import { getSessionUserId } from "../services/authService";
import { resolveSupabaseProfileId } from "../services/profileService";
import { getMealById, type MealDbMeal } from "../services/api";
import {extractIngredients,getTimeLabels,splitSteps,titleParts,} from "../services/recipeService";
import "../styles/recipes.css";
import "../styles/recipeCard.css";

// fila de ingredientes con precio en supabase
type IngredientRow = {
  id: number;
  name: string | null;
  price: number | string | null;
};
type IngredientIndex = {
  byNorm: Map<string, number>;
  list: Array<{ id: number; name: string; norm: string }>;
  priceById: Map<number, number>;
};

type SavedRecipeRow = {
  id: string;
  user_id: string;
  recipe_id: string;
  recipe_name: string | null;
  saved_at: string;
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

async function getIngredientIndex(): Promise<IngredientIndex> {
  if (ingredientIndexPromise) return ingredientIndexPromise;
  ingredientIndexPromise = (async () => {
    const { data, error } = await supabase
      .from("ingredients")
      .select("id,name,price");
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

const fmtCop = (n: number) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(
    Math.round(n),
  );

const assetIcon = (f: string) =>
  `/assets/images-icons/${encodeURIComponent(f)}`;
const ICON_PREP = assetIcon("PrepTime.png");
const ICON_COOK = assetIcon("CookingTime.png");
const ICON_COST = assetIcon("Budget.png");

function IngredientThumb({ name }: { name: string }) {
  const [ok, setOk] = useState(true);
  const src = `https://www.themealdb.com/images/ingredients/${encodeURIComponent(name)}.png`;
  if (!ok) return null;
  return (
    <img
      className="recipe-detail__ingredientImg"
      src={src}
      alt=""
      aria-hidden="true"
      onError={() => setOk(false)}
    />
  );
}

const RecipeDetailPage = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [meal, setMeal] = useState<MealDbMeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ingredientPrices, setIngredientPrices] = useState<Map<string, number>>(
    new Map(),
  );
  const [totalCost, setTotalCost] = useState<number>(0);
  const [isSaved, setIsSaved] = useState(false);
  const [savedRowId, setSavedRowId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const ingredients = useMemo(() => extractIngredients(meal), [meal]);

  function onBack() {
    if (window.history.length > 1) {
      nav(-1);
      return;
    }
    nav("/recipes");
  }

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        setMeal(null);
        setIngredientPrices(new Map());
        setTotalCost(0);

        if (!id) {
          setError("Missing recipe id");
          return;
        }

        const r = await getMealById(id);
        if (!alive) return;
        setMeal(r);
        if (!r) setError("Recipe not found");

        const ingredients = extractIngredients(r);
        if (!ingredients.length) return;
        const index = await getIngredientIndex();
        const priceByName = new Map<string, number>();
        let total = 0;
        for (const ing of ingredients) {
          const pickedId = pickBestIngredientId(ing.name, index);
          const price = pickedId
            ? Number(index.priceById.get(pickedId) ?? 0)
            : 0;
          if (Number.isFinite(price) && price > 0) {
            priceByName.set(ing.name, price);
            total += price;
          }
        }
        if (!alive) return;
        setIngredientPrices(priceByName);
        setTotalCost(total);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    let alive = true;
    async function run() {
      setIsSaved(false);
      setSavedRowId(null);
      setSaveError(null);
      const mealId = String(meal?.idMeal ?? "").trim();
      if (!mealId) return;
      const uid = await getSessionUserId();
      if (!uid) return;
      const profileId = await resolveSupabaseProfileId(uid, false);
      if (!profileId) return;
      const { data: saved, error } = await supabase
        .from("saved_recipes")
        .select("id")
        .eq("user_id", profileId)
        .eq("recipe_id", mealId)
        .maybeSingle();
      if (!alive) return;
      if (error) return;
      setIsSaved(!!saved?.id);
      setSavedRowId(saved?.id ?? null);
    }
    run();
    return () => {
      alive = false;
    };
  }, [meal?.idMeal]);

  async function onToggleSaveRecipe() {
    const mealId = String(meal?.idMeal ?? "").trim();
    if (!mealId) return;

    try {
      setSaving(true);
      setSaveError(null);

      const uid = await getSessionUserId();
      if (!uid) {
        setSaveError("You must be logged in to save recipes.");
        return;
      }
      const profileId = await resolveSupabaseProfileId(uid, true);
      if (!profileId) {
        setSaveError("Could not resolve your profile id.");
        return;
      }

      if (isSaved) {
        const d = supabase
          .from("saved_recipes")
          .delete()
          .eq("user_id", profileId)
          .eq("recipe_id", mealId);
        if (savedRowId) d.eq("id", savedRowId);
        const { error: delErr } = await d;
        if (delErr) throw delErr;
        setIsSaved(false);
        setSavedRowId(null);
        return;
      }

      const payload: Pick<
        SavedRecipeRow,
        "user_id" | "recipe_id" | "recipe_name"
      > = {
        user_id: profileId,
        recipe_id: mealId,
        recipe_name: String(meal?.strMeal ?? ""),
      };

      const { data: inserted, error: insErr } = await supabase
        .from("saved_recipes")
        .insert(payload)
        .select("id")
        .single();
      if (insErr) throw insErr;
      setIsSaved(true);
      setSavedRowId(inserted?.id ?? null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div>Loading…</div>;
  if (error) return <div>{error}</div>;
  if (!meal) return <div>Recipe not found</div>;

  const { prepLabel, cookLabel } = getTimeLabels(meal);
  const title = String(meal.strMeal ?? "");
  const { first, rest } = titleParts(title);
  const steps = splitSteps(meal.strInstructions ?? null);

  return (
    <div className="recipes-page recipe-detail-page">
      <div className="recipes-wrap recipe-detail-wrap">
        <div className="recipe-detail-top">
          <div className="recipe-detail-mobileHeader">
            <button
              type="button"
              className="recipe-detail-mobileBack"
              onClick={onBack}
              aria-label="Back"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <div className="recipe-detail-mobileTitle">{title}</div>
            <div />
          </div>
          <button
            type="button"
            className="recipe-detail-back"
            onClick={onBack}
            aria-label="Back"
          >
            <span aria-hidden="true">‹</span>
          </button>

          <div className="recipe-detail-hero">
            <div className="recipe-detail-heroMedia">
              {meal.strMealThumb ? (
                <img
                  className="recipe-detail-heroImg"
                  src={meal.strMealThumb}
                  alt={title || "Recipe"}
                />
              ) : null}
            </div>

            <div className="recipe-detail-heroInfo">
              <h1 className="recipe-detail-title">
                <span className="recipe-detail-titleFirst">{first}</span>
                {rest ? (
                  <span className="recipe-detail-titleRest"> {rest}</span>
                ) : null}
              </h1>

              <div className="recipe-detail-meta">
                <div className="recipe-detail-metaGrid">
                  <div className="recipe-card__metaRow">
                    <span className="recipe-pill">
                      <img
                        className="recipe-pill__icon"
                        src={ICON_PREP}
                        alt=""
                        aria-hidden="true"
                      />
                      {prepLabel}
                    </span>
                    <span className="recipe-pill">
                      <img
                        className="recipe-pill__icon"
                        src={ICON_COOK}
                        alt=""
                        aria-hidden="true"
                      />
                      {cookLabel}
                    </span>
                  </div>
                  <div className="recipe-card__metaRow">
                    <span className="recipe-pill recipe-pill--cost">
                      <img
                        className="recipe-pill__icon"
                        src={ICON_COST}
                        alt=""
                        aria-hidden="true"
                      />
                      Total cost: {fmtCop(totalCost)}
                    </span>
                  </div>
                </div>
                <div className="recipe-detail-actions">
                  <button
                    type="button"
                    className={`recipe-detail-actionBtn ${isSaved ? "recipe-detail-actionBtn--saved" : ""}`}
                    aria-label={isSaved ? "Unsave recipe" : "Save recipe"}
                    aria-pressed={isSaved}
                    disabled={saving}
                    onClick={onToggleSaveRecipe}
                    data-label="Save"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="36"
                      height="36"
                      aria-hidden="true"
                    >
                      <path
                        fill="currentColor"
                        d="M7 3h10a2 2 0 0 1 2 2v16l-7-4-7 4V5a2 2 0 0 1 2-2Z"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="recipe-detail-actionBtn"
                    aria-label="Add to meal plan"
                    data-label="Add"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="36"
                      height="36"
                      aria-hidden="true"
                    >
                      <path
                        fill="currentColor"
                        d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm14 9H5v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V11ZM6 6a1 1 0 0 0-1 1v2h16V7a1 1 0 0 0-1-1H6Zm6 7a1 1 0 0 1 1 1v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-2H9a1 1 0 1 1 0-2h2v-2a1 1 0 0 1 1-1Z"
                      />
                    </svg>
                  </button>
                </div>
                {saveError ? (
                  <p className="recipes-error">{saveError}</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <section className="recipe-detail-section">
          <h2 className="recipe-detail-h">Ingredients</h2>
          <div className="recipe-detail-ingredients">
            {ingredients.map((ing) => {
              const price = ingredientPrices.get(ing.name);
              return (
                <div
                  key={`${ing.name}-${ing.measure}`}
                  className="recipe-detail-ingredientCard"
                >
                  <IngredientThumb name={ing.name} />
                  <div className="recipe-detail-ingredientText">
                    <div className="recipe-detail-ingredientName">
                      {ing.name}
                    </div>
                    {price ? (
                      <div className="recipe-detail-ingredientPrice">
                        ${fmtCop(price)}
                      </div>
                    ) : null}
                  </div>
                  <div className="recipe-detail-ingredientMeasure">
                    {ing.measure}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="recipe-detail-section">
          <h2 className="recipe-detail-h">Steps</h2>
          <div className="recipe-detail-steps">
            {steps.map((s, idx) => (
              <div key={idx} className="recipe-detail-stepCard">
                <div className="recipe-detail-stepTitle">Step {idx + 1}</div>
                <div className="recipe-detail-stepBody">{s}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default RecipeDetailPage;
