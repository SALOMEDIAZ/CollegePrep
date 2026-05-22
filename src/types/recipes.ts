export const CATEGORY_FILTERS = ["Breakfast", "Lunch", "Dinner"] as const;
export type CategoryFilter = (typeof CATEGORY_FILTERS)[number];
