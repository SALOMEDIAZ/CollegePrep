import { useEffect, useMemo, useState } from "react";
import CreatePlanModal, { type CreatePlanValues } from "../components/MealPlan/CreatePlanModal";
import MealPlan from "../components/MealPlan/MealPlan";
import { useAppDispatch, useAppSelector } from "../store/store";
import {
  addDaysISO,
  bootstrapMealPlan,
  createWeekPlan,
  deleteCurrentPlan,
  formatDayTitle,
  mealPlanActions,
  replaceMeal,
  selectMealPlan,
  shiftWeek,
} from "../store/slices/mealPlanSlice";
import type { MealPlanDay, MealPlanViewModel, Weekday } from "../types/mealPlan";
import "../styles/recipes.css";
function weekdayFromISODate(iso: string): Weekday {
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setHours(0, 0, 0, 0);
  const map: Weekday[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return map[dt.getDay()] ?? "Mon";
}

const MealPlanPage = () => {
  const dispatch = useAppDispatch();
  const { loading, error, plan, cursorStartIso, cursorEndIso, cursorTitle, viewMode, selectedDay, creating, deleting } =
    useAppSelector(selectMealPlan);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    dispatch(bootstrapMealPlan());
  }, [dispatch]);

  const filteredPlan: MealPlanViewModel | null = useMemo(() => {
    if (!plan) return null;
    if (viewMode === "week") return plan;
    const day = selectedDay;
    if (!day) return plan;
    const existing = plan.days.find((d) => d.date === day);
    const dayVm: MealPlanDay = existing ?? { date: day, weekday: weekdayFromISODate(day), meals: [] };
    return { ...plan, days: [dayVm] };
  }, [plan, viewMode, selectedDay]);

  if (loading) return <div className="recipes-page"><div className="recipes-wrap"><p className="recipes-status">Loading…</p></div></div>;

  const todayIso = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  })();

  const headerTitle =
    viewMode === "day" && selectedDay ? formatDayTitle(selectedDay) : plan?.title ?? cursorTitle;

  async function gotoPrevNext(delta: number) {
    if (viewMode === "week") {
      await dispatch(shiftWeek(delta));
      return;
    }
    const base = selectedDay ?? (todayIso >= cursorStartIso && todayIso <= cursorEndIso ? todayIso : cursorStartIso);
    const next = addDaysISO(base, delta);
    if (next >= cursorStartIso && next <= cursorEndIso) {
      dispatch(mealPlanActions.setSelectedDay(next));
      return;
    }
    const weekDelta = delta < 0 ? -1 : 1;
    await dispatch(shiftWeek(weekDelta));
    dispatch(mealPlanActions.setSelectedDay(next));
  }

  return (
    <div className="recipes-page mp-page">
      <div className="recipes-wrap mp-wrap">
        {error ? <p className="recipes-error">{error}</p> : null}

        <div className="mp-navRow">
          <button type="button" className="mp-arrowBtn" onClick={() => gotoPrevNext(-1)}>
            ‹
          </button>
          <div className="mp-navTitle">{headerTitle}</div>
          <button type="button" className="mp-arrowBtn" onClick={() => gotoPrevNext(1)}>
            ›
          </button>
        </div>
        <div className="mp-segment">
          <button
            type="button"
            className={`mp-segBtn ${viewMode === "day" ? "mp-segBtn--active" : ""}`}
            onClick={() => {
              dispatch(mealPlanActions.setViewMode("day"));
              if (!selectedDay) {
                const d = todayIso >= cursorStartIso && todayIso <= cursorEndIso ? todayIso : cursorStartIso;
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

        {creating ? <div className="mp-creatingBanner">Creating plan…</div> : null}

        {!plan ? (
          <div className="mp-empty">
            <button type="button" className="mp-primaryBtn" onClick={() => setModalOpen(true)}>
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
      </div>
    </div>
  );
};

export default MealPlanPage;
