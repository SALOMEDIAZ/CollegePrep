import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type BudgetState = {
  weeklyBudget: number | null;
  usedPercent: number;
};

const initialState: BudgetState = {
  weeklyBudget: null,
  usedPercent: 0,
};

const budgetSlice = createSlice({
  name: "budget",
  initialState,
  reducers: {
    setWeeklyBudget(state, action: PayloadAction<number | null>) {
      state.weeklyBudget = action.payload;
    },
    setUsedPercent(state, action: PayloadAction<number>) {
      state.usedPercent = action.payload;
    },
    resetBudgetState() {
      return initialState;
    },
  },
});

export const { resetBudgetState, setUsedPercent, setWeeklyBudget } = budgetSlice.actions;
export default budgetSlice.reducer;
