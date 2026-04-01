import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getMealById, type MealDbMeal } from "../services/api";

const RecipeDetailPage = () => {
  const { id } = useParams();
  const [meal, setMeal] = useState<MealDbMeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        setMeal(null);

        if (!id) {
          setError("Missing recipe id");
          return;
        }

        const r = await getMealById(id);
        if (!alive) return;
        setMeal(r);
        if (!r) setError("Recipe not found");
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

  if (loading) return <div>Loading…</div>;
  if (error) return <div>{error}</div>;
  if (!meal) return <div>Recipe not found</div>;

  return (
    <div>
      <h1>{meal.strMeal}</h1>
      {meal.strMealThumb ? <img src={meal.strMealThumb} alt={meal.strMeal || "Recipe"} /> : null}
      {meal.strCategory ? <p>{meal.strCategory}</p> : null}
      {meal.strArea ? <p>{meal.strArea}</p> : null}
      {meal.strInstructions ? <p>{meal.strInstructions}</p> : null}
    </div>
  );
};

export default RecipeDetailPage;
