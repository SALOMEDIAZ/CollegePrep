// importamos react y hooks para estado local y efectos al montar
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
// componente que dibuja la grilla de comidas de la semana
import MealPlan from "../components/MealPlan/MealPlan";
// hooks de redux para leer estado y disparar acciones
import { useAppDispatch, useAppSelector } from "../store/store";
// acciones y selectores del slice del meal plan
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
// tipo de los valores que pide el modal al crear plan
import type { CreatePlanValues } from "../types/mealPlan";
// estilos de la pagina de recetas y meal plan
import "../styles/recipes.css";

// modal pesado: solo se descarga cuando hace falta
// lazy hace que el bundle principal sea mas chico al inicio
const CreatePlanModal = lazy(
  () => import("../components/MealPlan/CreatePlanModal"),
);

// pagina del meal plan semanal (redux maneja casi todo)
const MealPlanPage = () => {
  // dispatch para mandar acciones al store de redux
  const dispatch = useAppDispatch();
  // sacamos del slice todo lo que la ui necesita mostrar
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
    replacing,
    replacingTarget,
  } = useAppSelector(selectMealPlan);
  // estado local: si el modal de crear plan esta abierto o cerrado
  const [modalOpen, setModalOpen] = useState(false);

  // al entrar: trae plan activo o deja vacio para crear uno
  // este efecto corre una vez cuando entras a /mealplan
  useEffect(() => {
    // bootstrap intenta cargar el plan de la semana visible
    dispatch(bootstrapMealPlan());
  }, [dispatch]);

  // plan filtrado segun si ves dia o semana completa
  const filteredPlan = useAppSelector(selectMealPlanFilteredPlan);
  // titulo que va entre las flechas (rango de fechas)
  const headerTitle = useAppSelector(selectMealPlanHeaderTitle);

  // hoy en yyyy-mm-dd para seleccionar dia por defecto
  // useMemo evita recalcular la fecha en cada render
  const todayIso = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    // mes va de 0 a 11 por eso sumamos 1
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  // si aun esta cargando datos mostramos pantalla simple de loading
  if (loading)
    return (
      <div className="recipes-page">
        <div className="recipes-wrap">
          <p className="recipes-status">Loading…</p>
        </div>
      </div>
    );

  // vista principal cuando ya termino de cargar
  return (
    <div className="recipes-page mp-page">
      <div className="recipes-wrap mp-wrap">
        {/* si hubo error de supabase o red lo mostramos arriba */}
        {error ? <p className="recipes-error">{error}</p> : null}

        {/* flechas cambian la semana en el slice */}
        <div className="mp-navRow">
          {/* flecha izquierda: semana anterior */}
          <button
            type="button"
            className="mp-arrowBtn"
            onClick={() => dispatch(navigateMealPlan(-1))}
          >
            ‹
          </button>
          {/* texto con el rango de la semana actual */}
          <div className="mp-navTitle">{headerTitle}</div>
          {/* flecha derecha: semana siguiente */}
          <button
            type="button"
            className="mp-arrowBtn"
            onClick={() => dispatch(navigateMealPlan(1))}
          >
            ›
          </button>
        </div>

        {/* day muestra un solo dia; week la grilla completa */}
        <div className="mp-segment">
          {/* boton para ver solo un dia del plan */}
          <button
            type="button"
            className={`mp-segBtn ${viewMode === "day" ? "mp-segBtn--active" : ""}`}
            onClick={() => {
              // cambiamos el modo en redux a vista por dia
              dispatch(mealPlanActions.setViewMode("day"));
              // si no habia dia elegido ponemos hoy o el inicio de semana
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
          {/* boton para ver los 7 dias en grilla */}
          <button
            type="button"
            className={`mp-segBtn ${viewMode === "week" ? "mp-segBtn--active" : ""}`}
            onClick={() => dispatch(mealPlanActions.setViewMode("week"))}
          >
            Week
          </button>
        </div>

        {/* banner mientras se crea un plan nuevo en segundo plano */}
        {creating ? (
          <div className="mp-creatingBanner">Creating plan…</div>
        ) : null}

        {/* si no hay plan para esta semana mostramos boton de crear */}
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
            {/* grilla de comidas con opcion de reemplazar plato */}
            <MealPlan
              plan={filteredPlan}
              replacingTarget={replacing ? replacingTarget : null}
              onReplaceMeal={(args) => {
                dispatch(replaceMeal(args));
              }}
            />
            {/* acciones al final de la pagina */}
            <div className="mp-bottomActions">
              <button
                type="button"
                className="mp-dangerBtn"
                disabled={creating || deleting || replacing}
                onClick={() => dispatch(deleteCurrentPlan())}
              >
                Delete plan
              </button>
            </div>
          </div>
        ) : null}

        {/* modal solo se monta cuando Suspense lo permite */}
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
