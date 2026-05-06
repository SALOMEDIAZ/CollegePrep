// FILA DE PERFIL EN SUPABASE (DATOS DE LA APP)
export type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  age: number | null;
  location: string | null;
  university: string | null;
  career: string | null;
  avatar_url: string | null;
  budget_percent: number | null;
  allergies: string[] | null;
  vegetarian: boolean | null;
  vegan: boolean | null;
  gluten_free: boolean | null;
  lactose_free: boolean | null;
  omnivorous: boolean | null;
  notif_kitchen: boolean | null;
  notif_budget: boolean | null;
  notif_recipe: boolean | null;
};

export type ProfilePatch = Partial<Omit<ProfileRow, "id">>;
