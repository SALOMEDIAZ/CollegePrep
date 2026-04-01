import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL ?? "https://pvyyaqxnjiklpmzbbruu.supabase.co";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

if (!key) {
  console.warn("CollegePrep: create .env from .env.example and set VITE_SUPABASE_ANON_KEY.");
}

const supabase = createClient(url, key || "missing-supabase-key");

export default supabase;
