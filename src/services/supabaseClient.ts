import { createClient } from "@supabase/supabase-js";

// configuro el cliente de supabase con mis llaves
const url =
  import.meta.env.VITE_SUPABASE_URL ??
  // llamada supabase
  "https://pvyyaqxnjiklpmzbbruu.supabase.co";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

if (!key) {
  console.warn(
    // llamada supabase
    "CollegePrep: crea el .env del .env.example y pon la VITE_SUPABASE_ANON_KEY.",
  );
// paso del codigo
}

// bandera para saber si el .env tiene llaves validas
export const isSupabaseConfigured = Boolean(key && url);

// cliente de supabase para usar en toda la app
// si falta key usamos placeholder para no romper el import en dev
const supabase = createClient(url, key || "missing-supabase-key");

export default supabase;
