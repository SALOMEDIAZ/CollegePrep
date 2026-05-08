import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ProfileRow } from "../../types/profile";
import type { MealDbMeal } from "../../services/api";

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
    setMeals(state, action: PayloadAction<MealDbMeal[]>) {
      state.meals = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setForbiddenKeywords(state, action: PayloadAction<string[]>) {
      state.forbiddenKeywords = action.payload;
    },
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setSubmittedQuery(state, action: PayloadAction<string>) {
      state.submittedQuery = action.payload;
    },
    setProfile(state, action: PayloadAction<ProfileRow | null>) {
      state.profile = action.payload;
    },
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
