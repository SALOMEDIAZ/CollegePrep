import { createAsyncThunk, createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { getSessionUserId } from "../../services/authService";
import {
  createWeekPlanAndLoad,
  deletePlanAndSelectNext,
  fetchAllPlans,
  loadPlanViewModel,
  replaceMealInPlan,
  selectPlanForRangeAndLoad,
} from "../../services/mealPlanService";
import {
  addDaysISO,
  defaultSelectedDay,
  formatDayTitle,
  getWeekInfoForDate,
  getWeekInfoFromStartIso,
  shiftWeekStartIso,
} from "../../services/mealPlanLogic";
import type { RootState } from "../store";
import type { CreatePlanValues, MealPlanDay, MealPlanState, MealPlanViewModel, Weekday } from "../../types/mealPlan";

export { addDaysISO, formatDayTitle } from "../../services/mealPlanLogic";

function weekdayFromISODate(iso: string): Weekday {
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setHours(0, 0, 0, 0);
  const map: Weekday[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return map[dt.getDay()] ?? "Mon";
}

const initialCursor = getWeekInfoForDate(new Date(), 0);

const initialState: MealPlanState = {
  loading: false,
  error: null,
  userId: null,
  plans: [],
  planIndex: -1,
  planId: null,
  plan: null,
  cursorStartIso: initialCursor.startIso,
  cursorEndIso: initialCursor.endIso,
  cursorTitle: initialCursor.title,
  viewMode: "week",
  selectedDay: null,
  creating: false,
  deleting: false,
};

export const bootstrapMealPlan = createAsyncThunk("mealPlan/bootstrap", async () => {
  const uid = await getSessionUserId();
  if (!uid) throw new Error("Not authenticated");
  const rows = await fetchAllPlans(uid);
  if (!rows.length) {
    return {
      userId: uid,
      plans: rows,
      planIndex: -1,
      planId: null,
      plan: null,
      selectedDay: null,
      cursorStartIso: initialCursor.startIso,
      cursorEndIso: initialCursor.endIso,
      cursorTitle: initialCursor.title,
    };
  }
  const selected = await selectPlanForRangeAndLoad(uid, rows, initialCursor.startIso, initialCursor.endIso);
  return {
    userId: uid,
    plans: rows,
    ...selected,
    cursorStartIso: initialCursor.startIso,
    cursorEndIso: initialCursor.endIso,
    cursorTitle: initialCursor.title,
  };
});

export const shiftWeek = createAsyncThunk("mealPlan/shiftWeek", async (deltaWeeks: number, { getState }) => {
  const state = getState() as RootState;
  const userId = state.mealPlan.userId;
  const rows = state.mealPlan.plans;
  const nextStartIso = shiftWeekStartIso(state.mealPlan.cursorStartIso, deltaWeeks);
  const nextCursor = getWeekInfoFromStartIso(nextStartIso, new Date());
  if (!userId) {
    return {
      planIndex: -1,
      planId: null as string | null,
      plan: null as MealPlanState["plan"],
      selectedDay: null as string | null,
      cursorStartIso: nextCursor.startIso,
      cursorEndIso: nextCursor.endIso,
      cursorTitle: nextCursor.title,
    };
  }
  const selected = await selectPlanForRangeAndLoad(userId, rows, nextCursor.startIso, nextCursor.endIso);
  return { ...selected, cursorStartIso: nextCursor.startIso, cursorEndIso: nextCursor.endIso, cursorTitle: nextCursor.title };
});

export const loadPlanByIndex = createAsyncThunk("mealPlan/loadByIndex", async (idx: number, { getState }) => {
  const state = getState() as RootState;
  const userId = state.mealPlan.userId;
  const rows = state.mealPlan.plans;
  if (!userId || !rows.length || idx < 0 || idx >= rows.length) {
    return { planIndex: -1, planId: null as string | null, plan: null as MealPlanState["plan"], selectedDay: null as string | null };
  }
  const row = rows[idx];
  const plan = await loadPlanViewModel(userId, row);
  return { planIndex: idx, planId: row.id, plan, selectedDay: defaultSelectedDay(row) };
});

export const createWeekPlan = createAsyncThunk("mealPlan/createWeekPlan", async (values: CreatePlanValues, { getState }) => {
  const state = getState() as RootState;
  const userId = state.mealPlan.userId;
  if (!userId) throw new Error("Not authenticated");
  return createWeekPlanAndLoad(userId, values, state.mealPlan.plans, state.mealPlan.cursorStartIso);
});

export const deleteCurrentPlan = createAsyncThunk("mealPlan/deleteCurrentPlan", async (_, { getState }) => {
  const state = getState() as RootState;
  const userId = state.mealPlan.userId;
  const planId = state.mealPlan.planId;
  const plans = state.mealPlan.plans;
  if (!userId || !planId) throw new Error("No plan selected");
  return deletePlanAndSelectNext(userId, planId, plans, state.mealPlan.cursorStartIso, state.mealPlan.cursorEndIso);
});

export const replaceMeal = createAsyncThunk(
  "mealPlan/replaceMeal",
  async (args: { date: string; mealType: "breakfast" | "lunch" | "dinner"; recipeId: string }, { getState }) => {
    const state = getState() as RootState;
    const userId = state.mealPlan.userId;
    const planId = state.mealPlan.planId;
    const plan = state.mealPlan.plan;
    if (!userId || !planId || !plan) throw new Error("No plan selected");
    const row = state.mealPlan.plans.find((p) => p.id === planId);
    if (!row) throw new Error("Meal plan metadata not found.");
    const next = await replaceMealInPlan(userId, planId, plan, row, args);
    return { plan: next };
  },
);

const mealPlanSlice = createSlice({
  name: "mealPlan",
  initialState,
  reducers: {
    setViewMode(state, action: PayloadAction<MealPlanState["viewMode"]>) {
      state.viewMode = action.payload;
    },
    setSelectedDay(state, action: PayloadAction<string | null>) {
      state.selectedDay = action.payload;
    },
    resetMealPlanState() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrapMealPlan.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(bootstrapMealPlan.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.userId = action.payload.userId;
        state.plans = action.payload.plans;
        state.planIndex = action.payload.planIndex;
        state.planId = action.payload.planId;
        state.plan = action.payload.plan;
        state.selectedDay = action.payload.selectedDay;
        state.cursorStartIso = action.payload.cursorStartIso;
        state.cursorEndIso = action.payload.cursorEndIso;
        state.cursorTitle = action.payload.cursorTitle;
      })
      .addCase(bootstrapMealPlan.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? "Failed to load meal plan";
        state.userId = null;
        state.plans = [];
        state.planIndex = -1;
        state.planId = null;
        state.plan = null;
        state.selectedDay = null;
        state.cursorStartIso = initialCursor.startIso;
        state.cursorEndIso = initialCursor.endIso;
        state.cursorTitle = initialCursor.title;
      })
      .addCase(shiftWeek.fulfilled, (state, action) => {
        state.cursorStartIso = action.payload.cursorStartIso;
        state.cursorEndIso = action.payload.cursorEndIso;
        state.cursorTitle = action.payload.cursorTitle;
        state.planIndex = action.payload.planIndex;
        state.planId = action.payload.planId;
        state.plan = action.payload.plan;
        state.selectedDay = action.payload.selectedDay;
      })
      .addCase(loadPlanByIndex.fulfilled, (state, action) => {
        state.planIndex = action.payload.planIndex;
        state.planId = action.payload.planId;
        state.plan = action.payload.plan;
        state.selectedDay = action.payload.selectedDay;
      })
      .addCase(createWeekPlan.pending, (state) => {
        state.creating = true;
        state.error = null;
      })
      .addCase(createWeekPlan.fulfilled, (state, action) => {
        state.creating = false;
        state.error = null;
        state.plans = action.payload.plans;
        state.planIndex = action.payload.planIndex;
        state.planId = action.payload.planId;
        state.plan = action.payload.plan;
        state.selectedDay = action.payload.selectedDay;
      })
      .addCase(createWeekPlan.rejected, (state, action) => {
        state.creating = false;
        state.error = action.error.message ?? "Failed to create plan";
      })
      .addCase(deleteCurrentPlan.pending, (state) => {
        state.deleting = true;
        state.error = null;
      })
      .addCase(deleteCurrentPlan.fulfilled, (state, action) => {
        state.deleting = false;
        state.error = null;
        state.plans = action.payload.plans;
        state.planIndex = action.payload.planIndex;
        state.planId = action.payload.planId;
        state.plan = action.payload.plan;
        state.selectedDay = action.payload.selectedDay;
      })
      .addCase(deleteCurrentPlan.rejected, (state, action) => {
        state.deleting = false;
        state.error = action.error.message ?? "Failed to delete plan";
      })
      .addCase(replaceMeal.pending, (state) => {
        state.error = null;
      })
      .addCase(replaceMeal.fulfilled, (state, action) => {
        state.error = null;
        state.plan = action.payload.plan;
      })
      .addCase(replaceMeal.rejected, (state, action) => {
        state.error = action.error.message ?? "Failed to replace meal";
      });
  },
});

export const mealPlanActions = mealPlanSlice.actions;
export const selectMealPlan = (state: RootState) => state.mealPlan;

export const selectMealPlanFilteredPlan = createSelector([selectMealPlan], (s): MealPlanViewModel | null => {
  const plan = s.plan;
  if (!plan) return null;
  if (s.viewMode === "week") return plan;
  const day = s.selectedDay;
  if (!day) return plan;
  const existing = plan.days.find((d) => d.date === day);
  const dayVm: MealPlanDay = existing ?? { date: day, weekday: weekdayFromISODate(day), meals: [] };
  return { ...plan, days: [dayVm] };
});

export const selectMealPlanHeaderTitle = createSelector([selectMealPlan], (s) => {
  if (s.viewMode === "day" && s.selectedDay) return formatDayTitle(s.selectedDay);
  return s.plan?.title ?? s.cursorTitle;
});

export const navigateMealPlan = createAsyncThunk("mealPlan/navigate", async (delta: number, { dispatch, getState }) => {
  const state = getState() as RootState;
  const mp = state.mealPlan;
  const todayIso = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  })();

  if (mp.viewMode === "week") {
    await dispatch(shiftWeek(delta));
    return;
  }

  const base = mp.selectedDay ?? (todayIso >= mp.cursorStartIso && todayIso <= mp.cursorEndIso ? todayIso : mp.cursorStartIso);
  const next = addDaysISO(base, delta);
  if (next >= mp.cursorStartIso && next <= mp.cursorEndIso) {
    dispatch(mealPlanActions.setSelectedDay(next));
    return;
  }
  const weekDelta = delta < 0 ? -1 : 1;
  await dispatch(shiftWeek(weekDelta));
  dispatch(mealPlanActions.setSelectedDay(next));
});

export default mealPlanSlice.reducer;
