// grilla visual del plan semanal: dias, comidas y barra de presupuesto
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { MealPlanViewModel, MealType, ReplaceMealArgs } from "../../types/mealPlan";

export type { MealPlanDay, MealPlanMeal, MealPlanViewModel, MealType, Weekday } from "../../types/mealPlan";

// formatea pesos colombianos sin decimales
function fmtCop(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(n));
}

function useMediaQuery(query: string) {
  const getMatches = () => (typeof window !== "undefined" ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    const handler = () => setMatches(mql.matches);
    handler();
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

function fmtDayLabel(iso: string) {
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(dt);
  return `${month} ${dt.getDate()}`;
}

function mealTypeLabel(t: MealType) {
  if (t === "breakfast") return "Breakfast";
  if (t === "lunch") return "Lunch";
  return "Dinner";
}

function toThumbPreviewUrl(url: string) {
  const u = String(url || "").trim();
  if (!u) return null;
  if (u.endsWith("/preview")) return u;
  return `${u}/preview`;
}

export default function MealPlan({
  plan,
  replacingTarget,
  onReplaceMeal,
}: {
  plan: MealPlanViewModel;
  replacingTarget?: ReplaceMealArgs | null;
  onReplaceMeal?: (args: { date: string; mealType: MealType; recipeId: string }) => void;
}) {
  const pct = plan.budget > 0 ? Math.min(100, Math.round((plan.used / plan.budget) * 100)) : 0;

  const isMobile = useMediaQuery("(max-width: 640px)");
  const types: MealType[] = useMemo(() => ["breakfast", "lunch", "dinner"], []);
  const barStyle = useMemo(() => ({ ["--mp-fill" as string]: `${pct}%` }) as CSSProperties, [pct]);

  return (
    <div className="mp-plan">
      <div className="mp-budgetBar" style={barStyle}>
        <div className="mp-budgetBarFill" style={{ width: `${pct}%` }} />
        <div className="mp-budgetBarText mp-budgetBarText--desktop">{pct}% of the weekly budget used</div>
        <div className="mp-budgetBarText mp-budgetBarText--mobile">weekly budget used: {pct}%</div>
      </div>

      <div className="mp-days">
        {plan.days.map((d, dayIdx) => (
          <div key={d.date} className="mp-dayBlock">
            {!isMobile ? (
              <div className="mp-desktop">
              <div className="mp-dayHeader">
                <div className="mp-dayHeaderTitle">
                  {d.weekday} <span className="mp-dayHeaderDate">{d.date}</span>
                </div>
              </div>

              <div className="mp-mealRow">
                {d.meals.map((m, mealIdx) => {
                  const src = m.recipeThumb ? toThumbPreviewUrl(m.recipeThumb) : null;
                  const isLcp = dayIdx === 0 && mealIdx === 0;
                  return (
                  <div key={`${d.date}-${m.mealType}-${m.recipeId}`} className="mp-mealCard">
                    {src ? (
                      <img
                        className="mp-mealImg"
                        src={src}
                        alt=""
                        aria-hidden="true"
                        loading={isLcp ? "eager" : "lazy"}
                        decoding="async"
                        width={96}
                        height={96}
                        fetchPriority={isLcp ? "high" : "auto"}
                      />
                    ) : null}
                    <div className="mp-mealInfo">
                      <div className="mp-mealType">{mealTypeLabel(m.mealType)}</div>
                      <div className="mp-mealName">{m.recipeName}</div>
                      <div className="mp-mealCost">${fmtCop(m.cost)}</div>
                    </div>
                    <div className="mp-mealActions">
                      {replacingTarget &&
                      replacingTarget.date === d.date &&
                      replacingTarget.mealType === m.mealType &&
                      replacingTarget.recipeId === m.recipeId ? null : (
                        <Link className="mp-seeRecipeBtn" to={`/recipes/${m.recipeId}`}>
                          See recipe
                        </Link>
                      )}
                      {onReplaceMeal ? (
                        <button
                          type="button"
                          className={`mp-changeBtn ${
                            replacingTarget &&
                            replacingTarget.date === d.date &&
                            replacingTarget.mealType === m.mealType &&
                            replacingTarget.recipeId === m.recipeId
                              ? "mp-changeBtn--busy"
                              : ""
                          }`}
                          disabled={
                            !!(
                              replacingTarget &&
                              replacingTarget.date === d.date &&
                              replacingTarget.mealType === m.mealType &&
                              replacingTarget.recipeId === m.recipeId
                            )
                          }
                          onClick={() => onReplaceMeal({ date: d.date, mealType: m.mealType, recipeId: m.recipeId })}
                          aria-label="Change recipe"
                          title="Change recipe"
                        >
                          {replacingTarget &&
                          replacingTarget.date === d.date &&
                          replacingTarget.mealType === m.mealType &&
                          replacingTarget.recipeId === m.recipeId ? (
                            <span className="mp-changeBtnText">Changing recipe</span>
                          ) : (
                            <svg viewBox="0 0 24 24" aria-hidden="true" className="mp-changeIcon">
                              <path d="M6 9a7 7 0 0 1 12.1-4.9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              <path d="M18 4v4h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M18 15a7 7 0 0 1-12.1 4.9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              <path d="M6 20v-4h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  );
                })}
                {!d.meals.length ? <div className="mp-emptyDay">No meals planned</div> : null}
              </div>
            </div>
            ) : (
            <div className="mp-mobile">
              <div className="mp-dayTitle">{fmtDayLabel(d.date)}</div>

              {d.meals.length ? (
                <div className="mp-mealGroups">
                  {types
                    .map((t) => ({
                      type: t,
                      meals: d.meals.filter((m) => m.mealType === t),
                    }))
                    .filter((g) => g.meals.length > 0)
                    .map((g) => {
                      const subtotal = g.meals.reduce((acc, m) => acc + Number(m.cost || 0), 0);
                      return (
                        <div key={`${d.date}-${g.type}`} className="mp-mealGroup">
                          <div className="mp-mealGroupHeader">
                            <div className="mp-mealGroupTitle">{mealTypeLabel(g.type)}</div>
                            <div className="mp-mealGroupCost">{fmtCop(subtotal)}</div>
                          </div>

                          <div className="mp-mealRow">
                            {g.meals.map((m, mealIdx) => {
                              const src = m.recipeThumb ? toThumbPreviewUrl(m.recipeThumb) : null;
                              const isLcp = dayIdx === 0 && mealIdx === 0;
                              return (
                              <div key={`${d.date}-${m.mealType}-${m.recipeId}`} className="mp-mealCard">
                                {src ? (
                                  <img
                                    className="mp-mealImg"
                                    src={src}
                                    alt=""
                                    aria-hidden="true"
                                    loading={isLcp ? "eager" : "lazy"}
                                    decoding="async"
                                    width={96}
                                    height={96}
                                    fetchPriority={isLcp ? "high" : "auto"}
                                  />
                                ) : null}
                                <div className="mp-mealInfo">
                                  <div className="mp-mealType">{mealTypeLabel(m.mealType)}</div>
                                  <div className="mp-mealName">{m.recipeName}</div>
                                  <div className="mp-mealCost">{fmtCop(m.cost)}</div>
                                </div>
                                <div className="mp-mealActions">
                                  {replacingTarget &&
                                  replacingTarget.date === d.date &&
                                  replacingTarget.mealType === m.mealType &&
                                  replacingTarget.recipeId === m.recipeId ? null : (
                                    <Link className="mp-seeRecipeBtn" to={`/recipes/${m.recipeId}`}>
                                      See recipe
                                    </Link>
                                  )}
                                  {onReplaceMeal ? (
                                    <button
                                      type="button"
                                      className={`mp-changeBtn ${
                                        replacingTarget &&
                                        replacingTarget.date === d.date &&
                                        replacingTarget.mealType === m.mealType &&
                                        replacingTarget.recipeId === m.recipeId
                                          ? "mp-changeBtn--busy"
                                          : ""
                                      }`}
                                      disabled={
                                        !!(
                                          replacingTarget &&
                                          replacingTarget.date === d.date &&
                                          replacingTarget.mealType === m.mealType &&
                                          replacingTarget.recipeId === m.recipeId
                                        )
                                      }
                                      onClick={() => onReplaceMeal({ date: d.date, mealType: m.mealType, recipeId: m.recipeId })}
                                      aria-label="Change recipe"
                                      title="Change recipe"
                                    >
                                      {replacingTarget &&
                                      replacingTarget.date === d.date &&
                                      replacingTarget.mealType === m.mealType &&
                                      replacingTarget.recipeId === m.recipeId ? (
                                        <span className="mp-changeBtnText">Changing recipe</span>
                                      ) : (
                                        <svg viewBox="0 0 24 24" aria-hidden="true" className="mp-changeIcon">
                                          <path d="M6 9a7 7 0 0 1 12.1-4.9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                          <path d="M18 4v4h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                          <path d="M18 15a7 7 0 0 1-12.1 4.9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                          <path d="M6 20v-4h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      )}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="mp-emptyDay">No meals planned</div>
              )}
            </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
