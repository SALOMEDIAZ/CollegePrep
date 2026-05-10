import { useEffect, useState } from "react";
import {searchMealsByFirstLetter,searchMealsByName,type MealDbMeal,} from "../services/api";
import RecipeCard from "../components/Recipes/RecipeCard";
import "../styles/recipes.css";
import {ensureProfileRow,fetchAllergyKeywords,} from "../services/profileService";
import type { ProfileRow } from "../types/profile";
import { getSessionUserId } from "../services/authService";
import { useAppDispatch, useAppSelector } from "../store/store";
import {setMeals,setLoading,setError,setForbiddenKeywords,setSearchQuery,setSubmittedQuery,setProfile,} from "../store/slices/recipeSlice";

// Categorías disponibles para filtrar (deben coincidir con strCategory de TheMealDB)
const CATEGORY_FILTERS = ["Breakfast", "Lunch", "Dinner"] as const;
type CategoryFilter = (typeof CATEGORY_FILTERS)[number];

// Mapeo de categorías a las que usa TheMealDB
// "Lunch" y "Dinner" no existen como tal en MealDB, se usan varias categorías equivalentes
const CATEGORY_MAP: Record<CategoryFilter, string[]> = {
  Breakfast: ["Breakfast"],
  Lunch: ["Side", "Starter", "Vegetarian", "Vegan", "Miscellaneous"],
  Dinner: ["Beef", "Chicken", "Lamb", "Pork", "Seafood", "Pasta", "Goat"],
};

// normaliza strings para comparar (sin tildes, minúsculas, etc)
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

// extrae todos los ingredientes de una receta
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

// obtiene las restricciones dietéticas del perfil (vegan, gluten free, etc)
function getDietRestrictions(profile: ProfileRow | null) {
  if (!profile) return [];
  const restrictions: string[] = [];
  if (profile.vegan) restrictions.push("vegan");
  else if (profile.vegetarian) restrictions.push("vegetarian");
  if (profile.gluten_free) restrictions.push("gluten_free", "gluten");
  if (profile.lactose_free) restrictions.push("lactose_free", "lactose");
  return restrictions;
}

// si es vegetariano o vegano, obtengo las palabras clave para filtrar
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

// chequea si una palabra coincide con alguna palabra clave
function matchesKeyword(text: string, keywords: string[]) {
  const normalized = norm(text);
  if (!normalized) return false;
  return keywords.some(
    (kw) => normalized === norm(kw) || normalized.includes(norm(kw)),
  );
}

// valida si una receta es permitida según alergias y restricciones
function isMealAllowed(meal: MealDbMeal, forbiddenKeywords: string[]) {
  if (!forbiddenKeywords.length) return true;

  const ingredients = extractMealIngredientNames(meal);
  const title = String(meal.strMeal ?? "");
  const category = String(meal.strCategory ?? "");
  const textToCheck = [...ingredients, title, category];

  return !textToCheck.some((text) => matchesKeyword(text, forbiddenKeywords));
}

// filtra recetas por categoría activa
function filterByCategory(
  meals: MealDbMeal[],
  activeCategory: CategoryFilter | null,
): MealDbMeal[] {
  if (!activeCategory) return meals;
  const allowed = CATEGORY_MAP[activeCategory].map((c) => c.toLowerCase());
  return meals.filter((m) =>
    allowed.includes(String(m.strCategory ?? "").toLowerCase()),
  );
}

// página principal de recetas con búsqueda y filtros
const RecipesPage = () => {
  const dispatch = useAppDispatch();
  const query = useAppSelector((state) => state.recipes.searchQuery);
  const submittedQuery = useAppSelector(
    (state) => state.recipes.submittedQuery,
  );
  const loading = useAppSelector((state) => state.recipes.loading);
  const error = useAppSelector((state) => state.recipes.error);
  const meals = useAppSelector((state) => state.recipes.meals);

  // Estado local para la categoría activa
  const [activeCategory, setActiveCategory] = useState<CategoryFilter | null>(
    null,
  );

  const isSearchMode = submittedQuery.trim().length > 0;

  // Recetas filtradas por categoría (se aplica sobre las meals del store)
  const displayedMeals = filterByCategory(meals, activeCategory);

  // Toggle de categoría: si ya está activa se desactiva, si no se activa
  function handleCategoryToggle(category: CategoryFilter) {
    setActiveCategory((prev) => (prev === category ? null : category));
  }

  // Un solo efecto: mismo cálculo de keywords que antes + mismo fetch que antes.
  // Evita el segundo disparo cuando forbiddenKeywords llegaba desde Redux (doble recarga).
  useEffect(() => {
    let alive = true;

    const run = async () => {
      try {
        dispatch(setLoading(true));
        dispatch(setError(null));

        const uid = await getSessionUserId();
        if (!uid || !alive) {
          dispatch(setProfile(null));
          dispatch(setForbiddenKeywords([]));
          dispatch(setMeals([]));
          return;
        }

        const { profile: p } = await ensureProfileRow(uid);
        if (!alive) return;
        dispatch(setProfile(p));

        let forbiddenKeywords: string[] = [];
        if (!p) {
          forbiddenKeywords = [];
          dispatch(setForbiddenKeywords([]));
        } else {
          const allergies = (
            Array.isArray(p.allergies) ? p.allergies : []
          ).map((x) => String(x ?? ""));
          const dietRestrictions = getDietRestrictions(p);
          const allRestrictions = [...allergies, ...dietRestrictions];

          try {
            const keywords = await fetchAllergyKeywords(allRestrictions);
            const fallback = getFallbackKeywords(dietRestrictions);
            forbiddenKeywords = [...allRestrictions, ...keywords, ...fallback];
            if (alive) dispatch(setForbiddenKeywords(forbiddenKeywords));
          } catch {
            forbiddenKeywords = allRestrictions;
            if (alive) dispatch(setForbiddenKeywords(allRestrictions));
          }
        }

        if (!alive) return;

        if (isSearchMode) {
          const results = await searchMealsByName(submittedQuery.trim());
          if (!alive) return;
          dispatch(
            setMeals(
              results.filter((m) => isMealAllowed(m, forbiddenKeywords)),
            ),
          );
          return;
        }

        const mealResults: MealDbMeal[] = [];
        const seenIds = new Set<string>();
        const alphabet = Array.from("abcdefghijklmnopqrstuvwxyz");
        const usedLetters = new Set<string>();

        for (let attempts = 0; attempts < 6 && mealResults.length < 9; attempts++) {
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
                mealResults.push(meal);
              }
            }
          }
        }

        if (alive)
          dispatch(
            setMeals(mealResults.sort(() => Math.random() - 0.5).slice(0, 9)),
          );
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        const msg =
          raw === "Failed to fetch"
            ? "Could not reach TheMealDB. Check your connection and try again."
            : raw;
        if (alive) {
          dispatch(setError(msg));
          dispatch(setMeals([]));
        }
      } finally {
        if (alive) dispatch(setLoading(false));
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [dispatch, isSearchMode, submittedQuery]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    dispatch(setSubmittedQuery(query));
  }

  // Mensaje de "sin resultados" considerando el filtro de categoría activo
  const noResults = !loading && !error && displayedMeals.length === 0;
  const noResultsMessage = activeCategory
    ? `No ${activeCategory.toLowerCase()} recipes found${isSearchMode ? ` for "${submittedQuery}"` : ""}.`
    : isSearchMode
      ? "No results"
      : "No recipes match your preferences.";

  return (
    <div className="recipes-page">
      <div className="recipes-wrap">
        <div className="recipes-content">
          <h1 className="recipes-title">Our Recipes</h1>
          <div className="recipes-subrow">
            <div className="recipes-filterbar" aria-label="Recipe filters">
              {CATEGORY_FILTERS.map((category) => (
                <button
                  key={category}
                  className="recipes-chip"
                  type="button"
                  aria-pressed={activeCategory === category}
                  onClick={() => handleCategoryToggle(category)}
                >
                  {category}
                </button>
              ))}
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

          {noResults ? (
            <p className="recipes-status">{noResultsMessage}</p>
          ) : null}

          {displayedMeals.length ? (
            <div className="recipes-grid">
              {displayedMeals.map((m) => (
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