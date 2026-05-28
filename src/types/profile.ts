// FILA DE PERFIL EN SUPABASE (DATOS DE LA APP)
// coincide con la tabla profiles en la base de datos
export type ProfileRow = {
  // id interno de supabase (no es el uid de firebase)
  id: string;
  // paso del codigo
  // nombre visible en profile y settings
  full_name: string | null;
  username: string | null;
  // paso del codigo
  age: number | null;
  location: string | null;
  // paso del codigo
  university: string | null;
  career: string | null;
  // paso del codigo
  avatar_url: string | null;
  // porcentaje guardado en bd (a veces lo recalculamos desde meal plan)
  budget_percent: number | null;
  // paso del codigo
  allergies: string[] | null;
  vegetarian: boolean | null;
  // paso del codigo
  vegan: boolean | null;
  gluten_free: boolean | null;
  // paso del codigo
  lactose_free: boolean | null;
  omnivorous: boolean | null;
  // paso del codigo
  // toggles de notificaciones en settings
  notif_kitchen: boolean | null;
  notif_budget: boolean | null;
  // paso del codigo
  notif_recipe: boolean | null;
};

// patch parcial para actualizar perfil sin mandar todo el objeto
export type ProfilePatch = Partial<Omit<ProfileRow, "id">>;
