import { useEffect } from "react";
import {searchMealsByFirstLetter,searchMealsByName,type MealDbMeal,} from "../services/api";
import RecipeCard from "../components/Recipes/RecipeCard";
import "../styles/recipes.css";
import {ensureProfileRow,fetchAllergyKeywords,} from "../services/profileService";
import type { ProfileRow } from "../types/profile";
import { getSessionUserId } from "../services/authService";
import { useAppDispatch, useAppSelector } from "../store/store";
import {setMeals,setLoading,setError,setForbiddenKeywords,setSearchQuery,setSubmittedQuery,setProfile,} from "../store/slices/recipeSlice";

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

function extractMealIngredientNames(meal: MealDbMeal) {
  const ingredients: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const value = String(
      (meal as unknown as Record<string, unknown>)[`strIngredient${i}`] ?? "",
    ).trim();
    if (value) ingredients.push(value);
  }
  return ingredients;
}

function getDietRestrictions(profile: ProfileRow | null) {
  if (!profile) return [];
  const restrictions: string[] = [];
  if (profile.vegan) restrictions.push("vegan");
  else if (profile.vegetarian) restrictions.push("vegetarian");
  if (profile.gluten_free) restrictions.push("gluten_free", "gluten");
  if (profile.lactose_free) restrictions.push("lactose_free", "lactose");
  return restrictions;
}

function getFallbackKeywords(dietRestrictions: string[]) {
  const isVegetarian =
    dietRestrictions.includes("vegan") ||
    dietRestrictions.includes("vegetarian");
  if (!isVegetarian) return [];
  const meatKeywords = [
    "meat",
    "beef",
    "pork",
    "chicken",
    "turkey",
    "lamb",
    "fish",
    "seafood",
    "shrimp",
  ];
  const veganKeywords = [
    "egg",
    "milk",
    "cheese",
    "butter",
    "cream",
    "yogurt",
    "honey",
  ];
  return dietRestrictions.includes("vegan")
    ? [...meatKeywords, ...veganKeywords]
    : meatKeywords;
}

function matchesKeyword(text: string, keywords: string[]) {
  const normalized = norm(text);
  if (!normalized) return false;
  return keywords.some(
    (kw) => normalized === norm(kw) || normalized.includes(norm(kw)),
  );
}

function isMealAllowed(meal: MealDbMeal, forbiddenKeywords: string[]) {
  if (!forbiddenKeywords.length) return true;

  const ingredients = extractMealIngredientNames(meal);
  const title = String(meal.strMeal ?? "");
  const category = String(meal.strCategory ?? "");
  const textToCheck = [...ingredients, title, category];

  return !textToCheck.some((text) => matchesKeyword(text, forbiddenKeywords));
}

const RecipesPage = () => {
  const dispatch = useAppDispatch();
  const query = useAppSelector((state) => state.recipes.searchQuery);
  const submittedQuery = useAppSelector(
    (state) => state.recipes.submittedQuery,
  );
  const loading = useAppSelector((state) => state.recipes.loading);
  const error = useAppSelector((state) => state.recipes.error);
  const meals = useAppSelector((state) => state.recipes.meals);
  const forbiddenKeywords = useAppSelector(
    (state) => state.recipes.forbiddenKeywords,
  );
  const profile = useAppSelector((state) => state.recipes.profile);

  const isSearchMode = submittedQuery.trim().length > 0;

  useEffect(() => {
    let alive = true;
    const loadProfile = async () => {
      const uid = await getSessionUserId();
      if (!uid || !alive) return;
      const { profile: p } = await ensureProfileRow(uid);
      if (alive) dispatch(setProfile(p));
    };
    loadProfile();
    return () => {
      alive = false;
    };
  }, [dispatch]);

  useEffect(() => {
    let alive = true;
    const buildKeywordsList = async () => {
      if (!profile) {
        dispatch(setForbiddenKeywords([]));
        return;
      }

      const allergies = (
        Array.isArray(profile.allergies) ? profile.allergies : []
      ).map((x) => String(x ?? ""));
      const dietRestrictions = getDietRestrictions(profile);
      const allRestrictions = [...allergies, ...dietRestrictions];

      try {
        const keywords = await fetchAllergyKeywords(allRestrictions);
        const fallback = getFallbackKeywords(dietRestrictions);
        if (alive)
          dispatch(
            setForbiddenKeywords([
              ...allRestrictions,
              ...keywords,
              ...fallback,
            ]),
          );
      } catch {
        if (alive) dispatch(setForbiddenKeywords(allRestrictions));
      }
    };
    buildKeywordsList();
    return () => {
      alive = false;
    };
  }, [profile, dispatch]);

  useEffect(() => {
    let alive = true;
    const fetchRecipes = async () => {
      try {
        dispatch(setLoading(true));
        dispatch(setError(null));

        if (isSearchMode) {
          const results = await searchMealsByName(submittedQuery.trim());
          if (alive)
            dispatch(
              setMeals(
                results.filter((m) => isMealAllowed(m, forbiddenKeywords)),
              ),
            );
          return;
        }

        const meals: MealDbMeal[] = [];
        const seenIds = new Set<string>();
        const alphabet = Array.from("abcdefghijklmnopqrstuvwxyz");
        const usedLetters = new Set<string>();

        for (let attempts = 0; attempts < 6 && meals.length < 9; attempts++) {
          const availableLetters = alphabet.filter((l) => !usedLetters.has(l));
          if (!availableLetters.length) break;

          const selectedLetters = availableLetters
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);
          selectedLetters.forEach((l) => usedLetters.add(l));

          const lists = await Promise.all(
            selectedLetters.map((l) => searchMealsByFirstLetter(l)),
          );
          if (!alive) return;

          for (const list of lists) {
            for (const meal of list) {
              if (
                meal?.idMeal &&
                !seenIds.has(meal.idMeal) &&
                isMealAllowed(meal, forbiddenKeywords)
              ) {
                seenIds.add(meal.idMeal);
                meals.push(meal);
              }
            }
          }
        }

        if (alive)
          dispatch(setMeals(meals.sort(() => Math.random() - 0.5).slice(0, 9)));
      } catch (e) {
        if (alive) {
          dispatch(setError(e instanceof Error ? e.message : String(e)));
          dispatch(setMeals([]));
        }
      } finally {
        if (alive) dispatch(setLoading(false));
      }
    };
    fetchRecipes();
    return () => {
      alive = false;
    };
  }, [isSearchMode, submittedQuery, forbiddenKeywords, dispatch]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    dispatch(setSubmittedQuery(query));
  }

  return (
    <div className="recipes-page">
      <div className="recipes-wrap">
        <div className="recipes-content">
          <h1 className="recipes-title">Our Recipes</h1>
          <div className="recipes-subrow">
            <div className="recipes-filterbar" aria-label="Recipe filters">
              <button
                className="recipes-chip"
                type="button"
                aria-pressed="true"
              >
                Saves
              </button>
              <button
                className="recipes-chip"
                type="button"
                aria-pressed="false"
              >
                Breakfast
              </button>
              <button
                className="recipes-chip"
                type="button"
                aria-pressed="false"
              >
                Lunch
              </button>
              <button
                className="recipes-chip"
                type="button"
                aria-pressed="false"
              >
                Dinner
              </button>
            </div>

            <form
              onSubmit={onSubmit}
              className="recipes-search"
              aria-label="Search recipes"
            >
              <input
                className="recipes-search-input"
                value={query}
                onChange={(e) => dispatch(setSearchQuery(e.target.value))}
                placeholder="Search…"
                aria-label="Search recipes"
              />
              <button
                className="recipes-search-btn"
                type="submit"
                disabled={!query.trim() || loading}
              >
                Search
              </button>
            </form>
          </div>

          {loading ? <p className="recipes-status">Loading…</p> : null}
          {error ? <p className="recipes-error">{error}</p> : null}

          {!loading && !error && isSearchMode && meals.length === 0 ? (
            <p className="recipes-status">No results</p>
          ) : null}
          {!loading && !error && !isSearchMode && meals.length === 0 ? (
            <p className="recipes-status">No recipes match your preferences.</p>
          ) : null}

          {meals.length ? (
            <div className="recipes-grid">
              {meals.map((m) => (
                <RecipeCard key={m.idMeal} meal={m} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default RecipesPage;
