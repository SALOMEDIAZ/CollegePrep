import { useEffect, useMemo, useState } from "react";
import { searchMealsByName, type MealDbMeal } from "../services/api";
import RecipeCard from "../components/Recipes/RecipeCard";
import "../styles/recipes.css";

const RecipesPage = () => {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("a");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meals, setMeals] = useState<MealDbMeal[]>([]);

  const canSearch = useMemo(() => submittedQuery.trim().length > 0, [submittedQuery]);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!canSearch) {
        setMeals([]);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const r = await searchMealsByName(submittedQuery.trim());
        if (!alive) return;
        setMeals(r);
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
  }, [canSearch, submittedQuery]);

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

          {!loading && !error && canSearch && meals.length === 0 ? <p className="recipes-status">No results</p> : null}

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
