import { useEffect, useMemo, useState } from "react";
import { searchMealsByFirstLetter, searchMealsByName, type MealDbMeal } from "../services/api";
import RecipeCard from "../components/Recipes/RecipeCard";
import "../styles/recipes.css";
import { ensureProfileRow, fetchSessionUser, type ProfileRow } from "../services/profileSupabase";

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

function buildAvoidKeywordSet(profile: ProfileRow | null) {
  const allergies = (Array.isArray(profile?.allergies) ? profile?.allergies : []) ?? [];
  const avoid = new Set<string>();

  const add = (s: string) => {
    const n = norm(s);
    if (n) avoid.add(n);
  };

  for (const a of allergies) add(a);

  const allergyMap: Record<string, string[]> = {
    milk: ["milk", "cheese", "butter", "cream", "yogurt", "whey", "casein"],
    lactose: ["milk", "cheese", "butter", "cream", "yogurt", "whey", "casein"],
    peanut: ["peanut", "groundnut"],
    nuts: ["almond", "walnut", "cashew", "pecan", "hazelnut", "pistachio", "nut"],
    egg: ["egg"],
    soy: ["soy", "soya", "tofu"],
    sesame: ["sesame", "tahini"],
    gluten: ["wheat", "flour", "bread", "pasta", "noodle", "barley", "rye", "couscous", "cracker"],
    wheat: ["wheat", "flour", "bread", "pasta", "noodle"],
    shellfish: ["shrimp", "prawn", "crab", "lobster", "shellfish"],
    fish: [
      "fish",
      "seafood",
      "white fish",
      "fish fillet",
      "fish fillets",
      "cod",
      "haddock",
      "tilapia",
      "mackerel",
      "sardine",
      "sardines",
      "trout",
      "hake",
      "pollock",
      "halibut",
      "catfish",
      "swordfish",
      "snapper",
      "sea bass",
      "seabass",
      "bream",
      "sole",
      "herring",
      "salmon",
      "tuna",
      "anchovy",
      "anchovies",
    ],
  };

  for (const a of allergies) {
    const key = norm(String(a));
    const extras = allergyMap[key];
    if (extras) extras.forEach(add);
  }

  if (profile?.lactose_free) allergyMap.lactose.forEach(add);
  if (profile?.gluten_free) allergyMap.gluten.forEach(add);

  return avoid;
}

function buildDietKeywordSet(profile: ProfileRow | null) {
  const vegan = !!profile?.vegan;
  const vegetarian = !vegan && !!profile?.vegetarian;

  if (!vegan && !vegetarian) return { vegan, vegetarian, avoid: new Set<string>() };

  const baseNoMeat = [
    "beef",
    "steak",
    "mince",
    "ground beef",
    "beef mince",
    "oxtail",
    "ox tail",
    "pork",
    "ham hock",
    "pork belly",
    "pork chop",
    "ribs",
    "rib",
    "chicken",
    "chicken breast",
    "chicken thigh",
    "drumstick",
    "turkey",
    "lamb",
    "veal",
    "duck",
    "goat",
    "rabbit",
    "venison",
    "bacon",
    "ham",
    "sausage",
    "chorizo",
    "salami",
    "prosciutto",
    "pancetta",
    "mortadella",
    "pepperoni",
    "meat",
    "meatball",
    "meatballs",
    "fish",
    "seafood",
    "white fish",
    "fish fillet",
    "fish fillets",
    "salmon",
    "tuna",
    "cod",
    "haddock",
    "tilapia",
    "mackerel",
    "sardine",
    "sardines",
    "trout",
    "hake",
    "pollock",
    "halibut",
    "catfish",
    "swordfish",
    "snapper",
    "sea bass",
    "seabass",
    "bream",
    "sole",
    "herring",
    "anchovy",
    "anchovies",
    "fish sauce",
    "shrimp paste",
    "shrimp",
    "prawn",
    "crab",
    "lobster",
    "clam",
    "clams",
    "mussel",
    "mussels",
    "oyster",
    "oysters",
    "scallop",
    "scallops",
    "squid",
    "octopus",
    "calamari",
    "gelatin",
    "gelatine",
    "lard",
    "tallow",
    "suet",
    "beef stock",
    "beef broth",
    "chicken stock",
    "chicken broth",
    "fish stock",
    "fish broth",
  ];

  const veganExtras = ["egg", "milk", "cheese", "butter", "cream", "yogurt", "honey"];

  const avoid = new Set<string>();
  const add = (s: string) => avoid.add(norm(s));
  baseNoMeat.forEach(add);
  if (vegan) veganExtras.forEach(add);

  return { vegan, vegetarian, avoid };
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

  const isSearchMode = useMemo(() => submittedQuery.trim().length > 0, [submittedQuery]);
  const allergyAvoid = useMemo(() => buildAvoidKeywordSet(profile), [profile]);
  const dietAvoid = useMemo(() => buildDietKeywordSet(profile).avoid, [profile]);

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
