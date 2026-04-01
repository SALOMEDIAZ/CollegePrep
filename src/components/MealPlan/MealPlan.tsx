import { Link } from "react-router-dom";

export type MealType = "breakfast" | "lunch" | "dinner";
export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export type MealPlanMeal = {
  mealType: MealType;
  recipeId: string;
  recipeName: string;
  recipeThumb: string | null;
  cost: number;
};

export type MealPlanDay = {
  date: string;
  weekday: Weekday;
  meals: MealPlanMeal[];
};

export type MealPlanViewModel = {
  title: string;
  budget: number;
  used: number;
  days: MealPlanDay[];
};

function fmtCop(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(n));
}

function mealTypeLabel(t: MealType) {
  if (t === "breakfast") return "Breakfast";
  if (t === "lunch") return "Lunch";
  return "Dinner";
}

export default function MealPlan({ plan }: { plan: MealPlanViewModel }) {
  const pct = plan.budget > 0 ? Math.min(100, Math.round((plan.used / plan.budget) * 100)) : 0;

  return (
    <div className="mp-plan">
      <div className="mp-budgetBar">
        <div className="mp-budgetBarFill" style={{ width: `${pct}%` }} />
        <div className="mp-budgetBarText">{pct}% of the weekly budget used</div>
      </div>

      <div className="mp-weekTitle">{plan.title}</div>

      <div className="mp-days">
        {plan.days.map((d) => (
          <div key={d.date} className="mp-dayBlock">
            <div className="mp-dayHeader">
              <div className="mp-dayHeaderTitle">
                {d.weekday} <span className="mp-dayHeaderDate">{d.date}</span>
              </div>
            </div>

            <div className="mp-mealRow">
              {d.meals.map((m) => (
                <div key={`${d.date}-${m.mealType}-${m.recipeId}`} className="mp-mealCard">
                  {m.recipeThumb ? <img className="mp-mealImg" src={m.recipeThumb} alt="" aria-hidden="true" /> : null}
                  <div className="mp-mealInfo">
                    <div className="mp-mealType">{mealTypeLabel(m.mealType)}</div>
                    <div className="mp-mealName">{m.recipeName}</div>
                    <div className="mp-mealCost">${fmtCop(m.cost)}</div>
                  </div>
                  <Link className="mp-seeRecipeBtn" to={`/recipes/${m.recipeId}`}>
                    See recipe
                  </Link>
                </div>
              ))}
              {!d.meals.length ? <div className="mp-emptyDay">No meals planned</div> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

