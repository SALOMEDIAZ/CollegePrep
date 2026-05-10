import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import budgetReducer from "./slices/budgetSlice";
import mealPlanReducer from "./slices/mealPlanSlice";
import profileReducer from "./slices/profileSlice";
import recipeReducer from "./slices/recipeSlice";

// creo el store con todos mis reducers
export const store = configureStore({
  reducer: {
    budget: budgetReducer,
    mealPlan: mealPlanReducer,
    profile: profileReducer,
    recipes: recipeReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// hooks personalizados para typing automático
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
