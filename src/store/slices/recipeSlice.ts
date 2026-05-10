import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ProfileRow } from "../../types/profile";
import type { MealDbMeal } from "../../services/api";

// estado para las recetas, búsquedas y filtros de alergias
export type RecipeState = {
  loading: boolean;
  error: string | null;
  meals: MealDbMeal[];
  forbiddenKeywords: string[];
  searchQuery: string;
  submittedQuery: string;
  profile: ProfileRow | null;
};

const initialState: RecipeState = {
  loading: false,
  error: null,
  meals: [],
  forbiddenKeywords: [],
  searchQuery: "",
  submittedQuery: "",
  profile: null,
};

const recipeSlice = createSlice({
  name: "recipes",
  initialState,
  reducers: {
    // guardo las recetas que traje de la api
    setMeals(state, action: PayloadAction<MealDbMeal[]>) {
      state.meals = action.payload;
    },
    // controlo si está cargando las recetas
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    // guardo los errores que ocurren al buscar
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    // guardo las palabras clave que tengo que evitar (alergias y restricciones)
    setForbiddenKeywords(state, action: PayloadAction<string[]>) {
      state.forbiddenKeywords = action.payload;
    },
    // guardo lo que el usuario está escribiendo en la búsqueda
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    // guardo la búsqueda que ya envió (para saber si buscar o no)
    setSubmittedQuery(state, action: PayloadAction<string>) {
      state.submittedQuery = action.payload;
    },
    // guardo el perfil del usuario (con sus alergias y restricciones)
    setProfile(state, action: PayloadAction<ProfileRow | null>) {
      state.profile = action.payload;
    },
    // limpio todo el estado de recetas
    resetRecipesState() {
      return initialState;
    },
  },
});

export const {
  setMeals,
  setLoading,
  setError,
  setForbiddenKeywords,
  setSearchQuery,
  setSubmittedQuery,
  setProfile,
  resetRecipesState,
} = recipeSlice.actions;

export default recipeSlice.reducer;
