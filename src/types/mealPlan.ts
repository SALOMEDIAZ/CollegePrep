export type MealType = "breakfast" | "lunch" | "dinner";
export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export type MealPlanMeal = {
  mealType: MealType;
  recipeId: string;
  recipeName: string;
  recipeThumb: string | null;
  cost: number;
};

export type MealPlanDay = {
  date: string;
  weekday: Weekday;
  meals: MealPlanMeal[];
};

export type MealPlanViewModel = {
  title: string;
  budget: number;
  used: number;
  days: MealPlanDay[];
};

export type CreatePlanValues = {
  budget: number;
  onlySavedRecipes: boolean;
  onlyNewRecipes: boolean;
  selections: Record<Weekday, Record<MealType, boolean>>;
};

export type MealPlanRow = {
  id: string;
  user_id: string;
  name: string | null;
  start_date: string;
  end_date: string;
  budget: number | string | null;
  only_saved_recipes: boolean | null;
  only_new_recipes: boolean | null;
  created_at: string;
};

export type SavedRecipeRow = {
  id: string;
  user_id: string;
  recipe_id: string;
  recipe_name: string | null;
  saved_at: string;
};

export type IngredientRow = { id: number; name: string | null; price: number | string | null };

export type IngredientIndex = {
  byNorm: Map<string, number>;
  list: Array<{ id: number; name: string; norm: string }>;
  priceById: Map<number, number>;
};

export type MealPlanState = {
  loading: boolean;
  error: string | null;
  userId: string | null;
  plans: MealPlanRow[];
  planIndex: number;
  planId: string | null;
  plan: MealPlanViewModel | null;
  cursorStartIso: string;
  cursorEndIso: string;
  cursorTitle: string;
  viewMode: "week" | "day";
  selectedDay: string | null;
  creating: boolean;
  deleting: boolean;
};
