import { useEffect, useMemo, useState } from "react";
import { searchMealsByFirstLetter, searchMealsByName, type MealDbMeal } from "../services/api";
import RecipeCard from "../components/Recipes/RecipeCard";
import "../styles/recipes.css";
import {
  ensureProfileRow,
  fetchAllergyKeywords,
  fetchSessionUser,
  type ProfileRow,
} from "../services/profileSupabase";

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
  const out: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const k = `strIngredient${i}`;
    const v = String((meal as unknown as Record<string, unknown>)[k] ?? "").trim();
    if (v) out.push(v);
  }
  return out;
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

function matchesAnyKeyword(ingredient: string, keywords: Set<string>) {
  if (!keywords.size) return false;
  const ing = norm(ingredient);
  if (!ing) return false;
  for (const k of keywords) {
    if (!k) continue;
    if (ing === k) return true;
    if (ing.includes(k)) return true;
  }
  return false;
}

function sampleUnique<T>(items: T[], count: number) {
  if (count <= 0) return [];
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(count, arr.length));
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

const RecipesPage = () => {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meals, setMeals] = useState<MealDbMeal[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [allergyAvoid, setAllergyAvoid] = useState<Set<string>>(() => new Set());
  const [dietAvoid, setDietAvoid] = useState<Set<string>>(() => new Set());

  const isSearchMode = useMemo(() => submittedQuery.trim().length > 0, [submittedQuery]);

  useEffect(() => {
    let alive = true;
    async function run() {
      const u = await fetchSessionUser();
      if (!u) return;
      const { profile: p } = await ensureProfileRow(u.id);
      if (!alive) return;
      setProfile(p);
    }
    run();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!profile) {
        setAllergyAvoid(new Set());
        setDietAvoid(new Set());
        return;
      }

      const allergyValues = (Array.isArray(profile.allergies) ? profile.allergies : []).map((x) => String(x ?? ""));
      const dietKeys = dietKeysFromProfile(profile);

      try {
        const restrictionValues = allergyValues.concat(dietKeys);
        const allergyKeywords = await fetchAllergyKeywords(restrictionValues);
        const combined = allergyKeywords.concat(fallbackDietKeywords(dietKeys));
        if (!alive) return;

        const a = new Set<string>();
        for (const v of restrictionValues) {
          const n = norm(String(v));
          if (n) a.add(n);
        }
        for (const kw of combined) {
          const n = norm(String(kw));
          if (n) a.add(n);
        }

        setAllergyAvoid(a);
        setDietAvoid(new Set());
      } catch {
        if (!alive) return;
        const restrictionValues = allergyValues.concat(dietKeys);
        setAllergyAvoid(new Set(restrictionValues.map((v) => norm(v)).filter(Boolean)));
        setDietAvoid(new Set());
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [profile]);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        if (isSearchMode) {
          const r = await searchMealsByName(submittedQuery.trim());
          if (!alive) return;
          setMeals(r.filter((m) => mealAllowedWithSets(m, allergyAvoid, dietAvoid)));
          return;
        }

        const desiredCount = 9;
        const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
        const pickedLetters = new Set<string>();
        const pool: MealDbMeal[] = [];
        const poolIds = new Set<string>();

        for (let round = 0; round < 6 && pool.length < 60; round++) {
          const letters = sampleUnique(
            alphabet.filter((l) => !pickedLetters.has(l)),
            3,
          );
          if (!letters.length) break;
          letters.forEach((l) => pickedLetters.add(l));

          const lists = await Promise.all(letters.map((l) => searchMealsByFirstLetter(l)));
          if (!alive) return;
          for (const list of lists) {
            for (const m of list) {
              if (!m?.idMeal || poolIds.has(m.idMeal)) continue;
              poolIds.add(m.idMeal);
              if (!mealAllowedWithSets(m, allergyAvoid, dietAvoid)) continue;
              pool.push(m);
            }
          }
          if (pool.length >= desiredCount) break;
        }

        if (!alive) return;
        setMeals(sampleUnique(pool, desiredCount));
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
        setMeals([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [isSearchMode, submittedQuery, allergyAvoid, dietAvoid]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmittedQuery(query);
  }

  return (
    <div className="recipes-page">
      <div className="recipes-wrap">
        <div className="recipes-content">
          <h1 className="recipes-title">Our Recipes</h1>
          <div className="recipes-subrow">
            <div className="recipes-filterbar" aria-label="Recipe filters">
              <button className="recipes-chip" type="button" aria-pressed="true">
                Saves
              </button>
              <button className="recipes-chip" type="button" aria-pressed="false">
                Breakfast
              </button>
              <button className="recipes-chip" type="button" aria-pressed="false">
                Lunch
              </button>
              <button className="recipes-chip" type="button" aria-pressed="false">
                Dinner
              </button>
            </div>

            <form onSubmit={onSubmit} className="recipes-search" aria-label="Search recipes">
              <input
                className="recipes-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                aria-label="Search recipes"
              />
              <button className="recipes-search-btn" type="submit" disabled={!query.trim() || loading}>
                Search
              </button>
            </form>
          </div>

          {loading ? <p className="recipes-status">Loading…</p> : null}
          {error ? <p className="recipes-error">{error}</p> : null}

          {!loading && !error && isSearchMode && meals.length === 0 ? <p className="recipes-status">No results</p> : null}
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
