import { createClient } from "@supabase/supabase-js";

// configuro el cliente de supabase con mis llaves
const url =
  import.meta.env.VITE_SUPABASE_URL ??
  "https://pvyyaqxnjiklpmzbbruu.supabase.co";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

if (!key) {
  console.warn(
    "CollegePrep: crea el .env del .env.example y pon la VITE_SUPABASE_ANON_KEY.",
  );
}

export const isSupabaseConfigured = Boolean(key && url);

// cliente de supabase para usar en toda la app
const supabase = createClient(url, key || "missing-supabase-key");

export default supabase;
