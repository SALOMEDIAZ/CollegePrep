import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { fetchSessionUser } from "../../services/profileSupabase";
import {
  createWeekPlanAndLoad,
  deletePlanAndSelectNext,
  ensureProfileForUser,
  fetchAllPlans,
  getWeekInfoForDate,
  getWeekInfoFromStartIso,
  replaceMealInPlan,
  selectPlanForRange,
  shiftWeekStartIso,
} from "../../services/mealPlanService";
import type { RootState } from "../store";
import type { CreatePlanValues, MealPlanState } from "../../types/mealPlan";

export { addDaysISO, formatDayTitle } from "../../services/mealPlanService";

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
  const u = await fetchSessionUser();
  if (!u) throw new Error("Not authenticated");
  await ensureProfileForUser(u.id);
  const rows = await fetchAllPlans(u.id);
  if (!rows.length) {
    return {
      userId: u.id,
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
  const selected = selectPlanForRange(u.id, rows, initialCursor.startIso, initialCursor.endIso);
  return {
    userId: u.id,
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
      ...selectPlanForRange("", [], nextCursor.startIso, nextCursor.endIso),
      cursorStartIso: nextCursor.startIso,
      cursorEndIso: nextCursor.endIso,
      cursorTitle: nextCursor.title,
    };
  }
  const selected = selectPlanForRange(userId, rows, nextCursor.startIso, nextCursor.endIso);
  return { ...selected, cursorStartIso: nextCursor.startIso, cursorEndIso: nextCursor.endIso, cursorTitle: nextCursor.title };
});

export const loadPlanByIndex = createAsyncThunk("mealPlan/loadByIndex", async (idx: number, { getState }) => {
  const state = getState() as RootState;
  const userId = state.mealPlan.userId;
  const rows = state.mealPlan.plans;
  if (!userId || !rows.length || idx < 0 || idx >= rows.length) return selectPlanForRange(userId ?? "", [], "", "");
  return selectPlanForRange(userId, rows, rows[idx].start_date, rows[idx].end_date);
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

export default mealPlanSlice.reducer;
