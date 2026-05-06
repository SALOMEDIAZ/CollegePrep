import supabase from "./supabaseClient";

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

type AllergyRow = {
  id: string;
  key: string | null;
  name: string | null;
  category: string | null;
  created_at: string | null;
};

type AllergyKeywordRow = {
  id: string;
  allergy_key: string | null;
  keyword: string | null;
};

let allergyIndexPromise: Promise<Map<string, string>> | null = null;

function normKey(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getAllergyKeyIndex() {
  if (allergyIndexPromise) return allergyIndexPromise;
  allergyIndexPromise = (async () => {
    const { data, error } = await supabase.from("allergies").select("key,name");
    if (error) throw error;
    const map = new Map<string, string>();
    for (const row of (data ?? []) as Pick<AllergyRow, "key" | "name">[]) {
      const key = String(row.key ?? "").trim();
      const name = String(row.name ?? "").trim();
      if (key) map.set(normKey(key), key);
      if (name && key) map.set(normKey(name), key);
    }
    return map;
  })();
  return allergyIndexPromise;
}

export async function resolveAllergyKeys(allergyValues: string[]) {
  const values = (Array.isArray(allergyValues) ? allergyValues : []).map((s) => String(s ?? "").trim()).filter(Boolean);
  if (!values.length) return [];
  const index = await getAllergyKeyIndex();
  const out: string[] = [];
  for (const v of values) {
    const k = index.get(normKey(v));
    out.push(k ?? v);
  }
  return Array.from(new Set(out.map((x) => String(x).trim()).filter(Boolean)));
}

export async function fetchAllergyKeywords(allergyKeysOrNames: string[]) {
  const keys = await resolveAllergyKeys(allergyKeysOrNames);
  if (!keys.length) return [];
  const { data, error } = await supabase.from("allergy_keywords").select("keyword,allergy_key").in("allergy_key", keys);
  if (error) throw error;
  const rows = (data ?? []) as Array<Pick<AllergyKeywordRow, "keyword">>;
  return rows.map((r) => String(r.keyword ?? "").trim()).filter(Boolean);
}

export async function fetchSessionUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

export async function fetchProfileByUserId(userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) return { profile: null as ProfileRow | null, error };
  return { profile: data as ProfileRow | null, error: null as null };
}

export async function ensureProfileRow(userId: string) {
  const { profile, error } = await fetchProfileByUserId(userId);
  if (error) return { profile: null as ProfileRow | null, error };
  if (profile) return { profile, error: null as null };
  const { data, error: insErr } = await supabase.from("profiles").insert({ id: userId }).select("*").single();
  if (insErr) {
    const code = String((insErr as { code?: unknown })?.code ?? "");
    if (code === "23503") {
      await supabase.auth.signOut();
      return {
        profile: null as ProfileRow | null,
        error: new Error("Your login session is not valid for this database project. Please log in again."),
      };
    }
    return { profile: null as ProfileRow | null, error: insErr };
  }
  return { profile: data as ProfileRow, error: null as null };
}

export async function upsertProfile(userId: string, patch: ProfilePatch) {
  const row = { id: userId, ...patch };
  return supabase.from("profiles").upsert(row, { onConflict: "id" });
}

export async function persistAvatar(file: File, userId: string) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/avatar.${ext}`;
  const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (upErr) return { error: upErr };
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return upsertProfile(userId, { avatar_url: data.publicUrl });
}

export async function logoutUser() {
  return supabase.auth.signOut();
}

export async function wipeAccountAndSignOut() {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { error: new Error("No session") };
  const { data: files } = await supabase.storage.from("avatars").list(user.id);
  if (files?.length) {
    await supabase.storage.from("avatars").remove(files.map((f) => `${user.id}/${f.name}`));
  }
  await supabase.from("profiles").delete().eq("id", user.id);
  await supabase.auth.signOut();
  return {};
}


export async function fetchWeeklyBudgetUsedPercent(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("meal_plans")
    .select("id,start_date,end_date")
    .eq("user_id", userId)
    .order("start_date", { ascending: true });
  if (error || !data?.length) return 0;

  const rows = data as { id: string; start_date: string; end_date: string }[];
  const todayIso = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  })();

  let idx = rows.findIndex((r) => r.end_date >= todayIso);
  if (idx < 0) idx = rows.length - 1;
  const row = rows[idx];
  if (!row) return 0;

  const key = `mealplan:${userId}:${row.id}`;
  const raw = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
  if (!raw) return 0;

  try {
    const vm = JSON.parse(raw) as { budget?: number; used?: number };
    const b = Number(vm.budget ?? 0);
    const u = Number(vm.used ?? 0);
    if (b <= 0) return 0;
    return Math.min(100, Math.round((u / b) * 100));
  } catch {
    return 0;
  }
}
