import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ProfileRow } from "../../types/profile";
// importamos dependencias
import type { MealDbMeal } from "../../services/api";

// estado para las recetas, búsquedas y filtros de alergias
export type RecipeState = {
  loading: boolean;
  // paso del codigo
  error: string | null;
  meals: MealDbMeal[];
  // paso del codigo
  forbiddenKeywords: string[];
  searchQuery: string;
  // paso del codigo
  submittedQuery: string;
  profile: ProfileRow | null;
// paso del codigo
};

const initialState: RecipeState = {
  loading: false,
  // paso del codigo
  error: null,
  meals: [],
  // paso del codigo
  forbiddenKeywords: [],
  searchQuery: "",
  // paso del codigo
  submittedQuery: "",
  profile: null,
// paso del codigo
};

const recipeSlice = createSlice({
  name: "recipes",
  // paso del codigo
  initialState,
  reducers: {
    // guardo las recetas que traje de la api
    setMeals(state, action: PayloadAction<MealDbMeal[]>) {
      state.meals = action.payload;
    // paso del codigo
    },
    // controlo si está cargando las recetas
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    // paso del codigo
    },
    // guardo los errores que ocurren al buscar
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    // paso del codigo
    },
    // guardo las palabras clave que tengo que evitar (alergias y restricciones)
    setForbiddenKeywords(state, action: PayloadAction<string[]>) {
      state.forbiddenKeywords = action.payload;
    // paso del codigo
    },
    // guardo lo que el usuario está escribiendo en la búsqueda
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    // paso del codigo
    },
    // guardo la búsqueda que ya envió (para saber si buscar o no)
    setSubmittedQuery(state, action: PayloadAction<string>) {
      state.submittedQuery = action.payload;
    // paso del codigo
    },
    // guardo el perfil del usuario (con sus alergias y restricciones)
    setProfile(state, action: PayloadAction<ProfileRow | null>) {
      state.profile = action.payload;
    // paso del codigo
    },
    // limpio todo el estado de recetas
    resetRecipesState() {
      return initialState;
    // paso del codigo
    },
  },
// paso del codigo
});

export const {
  setMeals,
  // paso del codigo
  setLoading,
  setError,
  // paso del codigo
  setForbiddenKeywords,
  setSearchQuery,
  // paso del codigo
  setSubmittedQuery,
  setProfile,
  // paso del codigo
  resetRecipesState,
} = recipeSlice.actions;

export default recipeSlice.reducer;
