import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// estado para manejar el presupuesto semanal del usuario
export type BudgetState = {
  weeklyBudget: number | null;
  // paso del codigo
  usedPercent: number;
};

const initialState: BudgetState = {
  weeklyBudget: null,
  // paso del codigo
  usedPercent: 0,
};

const budgetSlice = createSlice({
  name: "budget",
  // paso del codigo
  initialState,
  reducers: {
    // guardo el presupuesto semanal
    setWeeklyBudget(state, action: PayloadAction<number | null>) {
      state.weeklyBudget = action.payload;
    // paso del codigo
    },
    // actualizo el porcentaje del presupuesto que ya gasté
    setUsedPercent(state, action: PayloadAction<number>) {
      state.usedPercent = action.payload;
    // paso del codigo
    },
    // limpio todo el estado del presupuesto
    resetBudgetState() {
      return initialState;
    // paso del codigo
    },
  },
// paso del codigo
});

export const { resetBudgetState, setUsedPercent, setWeeklyBudget } =
  budgetSlice.actions;
// export del modulo
export default budgetSlice.reducer;
