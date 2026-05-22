// tipos del planificador de comidas (meal planner)

export type MealType = "breakfast" | "lunch" | "dinner";
// dias de la semana en ingles (como vienen de la api)
export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

// una comida dentro de un dia del plan
export type MealPlanMeal = {
  mealType: MealType;
  recipeId: string;
  recipeName: string;
  recipeThumb: string | null;
  cost: number;
};

// un dia completo con sus comidas
export type MealPlanDay = {
  date: string;
  weekday: Weekday;
  meals: MealPlanMeal[];
};

// lo que pintamos en pantalla (titulo, presupuesto, dias)
export type MealPlanViewModel = {
  title: string;
  budget: number;
  used: number;
  days: MealPlanDay[];
};

// argumentos para cambiar una comida por otra receta
export type ReplaceMealArgs = { date: string; mealType: MealType; recipeId: string };

// valores del modal al crear un plan semanal
export type CreatePlanValues = {
  budget: number;
  onlySavedRecipes: boolean;
  onlyNewRecipes: boolean;
  selections: Record<Weekday, Record<MealType, boolean>>;
};

// fila del plan en supabase (metadata)
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

// receta guardada por el usuario
export type SavedRecipeRow = {
  id: string;
  user_id: string;
  recipe_id: string;
  recipe_name: string | null;
  saved_at: string;
};

// ingrediente con precio para calcular costos
export type IngredientRow = { id: number; name: string | null; price: number | string | null };

// indice en memoria para buscar ingredientes rapido
export type IngredientIndex = {
  byNorm: Map<string, number>;
  list: Array<{ id: number; name: string; norm: string }>;
  priceById: Map<number, number>;
};

// estado completo del slice de meal plan en redux
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
  replacing: boolean;
  replacingTarget: ReplaceMealArgs | null;
};
