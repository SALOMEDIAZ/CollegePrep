import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import MealPlan from "../components/MealPlan/MealPlan";
import { useAppDispatch, useAppSelector } from "../store/store";
import {
  bootstrapMealPlan,
  createWeekPlan,
  deleteCurrentPlan,
  navigateMealPlan,
  mealPlanActions,
  replaceMeal,
  selectMealPlan,
  selectMealPlanFilteredPlan,
  selectMealPlanHeaderTitle,
} from "../store/slices/mealPlanSlice";
import type { CreatePlanValues } from "../types/mealPlan";
import "../styles/recipes.css";

const CreatePlanModal = lazy(
  () => import("../components/MealPlan/CreatePlanModal"),
);

// página del planificador de comidas por semana
const MealPlanPage = () => {
  const dispatch = useAppDispatch();
  // obtengo todos los datos del plan desde redux
  const {
    loading,
    error,
    plan,
    cursorStartIso,
    cursorEndIso,
    cursorTitle,
    viewMode,
    selectedDay,
    creating,
    deleting,
  } = useAppSelector(selectMealPlan);
  // controlo si el modal de crear plan está abierto
  const [modalOpen, setModalOpen] = useState(false);

  // cargo el plan la primera vez que carga la página
  useEffect(() => {
    dispatch(bootstrapMealPlan());
  }, [dispatch]);

  // obtengo la versión filtrada del plan (por día si estoy en modo día)
  const filteredPlan = useAppSelector(selectMealPlanFilteredPlan);
  const headerTitle = useAppSelector(selectMealPlanHeaderTitle);

  // calculo la fecha de hoy en formato ISO
  const todayIso = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  // si estoy cargando, muestro un loading
  if (loading)
    return (
      <div className="recipes-page">
        <div className="recipes-wrap">
          <p className="recipes-status">Loading…</p>
        </div>
      </div>
    );

  return (
    <div className="recipes-page mp-page">
      <div className="recipes-wrap mp-wrap">
        {error ? <p className="recipes-error">{error}</p> : null}

        {/* controles para navegar entre semanas */}
        <div className="mp-navRow">
          <button
            type="button"
            className="mp-arrowBtn"
            onClick={() => dispatch(navigateMealPlan(-1))}
          >
            ‹
          </button>
          <div className="mp-navTitle">{headerTitle}</div>
          <button
            type="button"
            className="mp-arrowBtn"
            onClick={() => dispatch(navigateMealPlan(1))}
          >
            ›
          </button>
        </div>

        {/* botones para cambiar entre vista de día y semana */}
        <div className="mp-segment">
          <button
            type="button"
            className={`mp-segBtn ${viewMode === "day" ? "mp-segBtn--active" : ""}`}
            onClick={() => {
              dispatch(mealPlanActions.setViewMode("day"));
              if (!selectedDay) {
                const d =
                  todayIso >= cursorStartIso && todayIso <= cursorEndIso
                    ? todayIso
                    : cursorStartIso;
                dispatch(mealPlanActions.setSelectedDay(d));
              }
            }}
          >
            Day
          </button>
          <button
            type="button"
            className={`mp-segBtn ${viewMode === "week" ? "mp-segBtn--active" : ""}`}
            onClick={() => dispatch(mealPlanActions.setViewMode("week"))}
          >
            Week
          </button>
        </div>

        {/* aviso cuando estoy creando un plan */}
        {creating ? (
          <div className="mp-creatingBanner">Creating plan…</div>
        ) : null}

        {!plan ? (
          <div className="mp-empty">
            <button
              type="button"
              className="mp-primaryBtn"
              onClick={() => setModalOpen(true)}
            >
              Create week plan
            </button>
          </div>
        ) : filteredPlan ? (
          <div>
            <MealPlan
              plan={filteredPlan}
              onReplaceMeal={(args) => {
                dispatch(replaceMeal(args));
              }}
            />
            <div className="mp-bottomActions">
              <button
                type="button"
                className="mp-dangerBtn"
                disabled={creating || deleting}
                onClick={() => dispatch(deleteCurrentPlan())}
              >
                Delete plan
              </button>
            </div>
          </div>
        ) : null}

        <Suspense fallback={null}>
          <CreatePlanModal
            open={modalOpen}
            title={cursorTitle}
            initialBudget={300000}
            onClose={() => (creating ? null : setModalOpen(false))}
            onCreate={(values: CreatePlanValues) => {
              setModalOpen(false);
              dispatch(createWeekPlan(values));
            }}
          />
        </Suspense>
      </div>
    </div>
  );
};

export default MealPlanPage;
