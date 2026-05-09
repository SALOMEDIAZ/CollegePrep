import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// estado para manejar el presupuesto semanal del usuario
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
    // guardo el presupuesto semanal
    setWeeklyBudget(state, action: PayloadAction<number | null>) {
      state.weeklyBudget = action.payload;
    },
    // actualizo el porcentaje del presupuesto que ya gasté
    setUsedPercent(state, action: PayloadAction<number>) {
      state.usedPercent = action.payload;
    },
    // limpio todo el estado del presupuesto
    resetBudgetState() {
      return initialState;
    },
  },
});

export const { resetBudgetState, setUsedPercent, setWeeklyBudget } =
  budgetSlice.actions;
export default budgetSlice.reducer;
