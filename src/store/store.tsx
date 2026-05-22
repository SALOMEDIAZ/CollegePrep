// configureStore arma el store central de redux
import { configureStore } from "@reduxjs/toolkit";
// hooks oficiales de react-redux
import { useDispatch, useSelector } from "react-redux";
// cada slice es un pedazo de estado de la app
import budgetReducer from "./slices/budgetSlice";
import mealPlanReducer from "./slices/mealPlanSlice";
import profileReducer from "./slices/profileSlice";
import recipeReducer from "./slices/recipeSlice";

// creo el store con todos mis reducers
export const store = configureStore({
  reducer: {
    // presupuesto semanal y porcentaje usado
    budget: budgetReducer,
    // plan de comidas por semana
    mealPlan: mealPlanReducer,
    // usuario de firebase y cache de perfil supabase
    profile: profileReducer,
    // listado de recetas y busqueda
    recipes: recipeReducer,
  },
});

// tipo inferido de todo el estado global
export type RootState = ReturnType<typeof store.getState>;
// tipo del dispatch con todas las acciones
export type AppDispatch = typeof store.dispatch;

// hooks personalizados para typing automático
// asi no tengo que tipar useSelector a mano en cada pagina
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
