import supabase from "./supabaseClient";
import { signOut } from "firebase/auth";
import type { ProfilePatch, ProfileRow } from "../types/profile";
import type { CreatePlanValues, Weekday } from "../types/mealPlan";
import { auth } from "./firebase";
import { buildAvoidKeywordSets, buildMealsForSlots, buildRestrictionValues, fromISODate } from "./mealPlanLogic";

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

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function invalidSupabaseUserIdError() {
  return new Error(
    "Supabase expects UUID user ids in profiles.id, but Firebase returns non-UUID ids. Update your Supabase schema to support Firebase uid (text) or add a mapping table.",
  );
}

function invalidProfileIdFromRpcError() {
  return new Error("Could not resolve a valid profile id from Supabase RPC mapping.");
}

async function getProfileIdForFirebaseUid(firebaseUid: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_profile_id_for_firebase", { p_firebase_uid: firebaseUid });
  if (error) throw error;
  if (!data) return null;
  const id = String(data);
  return isUuid(id) ? id : null;
}

async function ensureProfileIdForFirebaseUid(firebaseUid: string): Promise<string> {
  const { data, error } = await supabase.rpc("ensure_profile_for_firebase", { p_firebase_uid: firebaseUid });
  if (error) {
    const status = Number((error as { status?: unknown })?.status ?? 0);
    const code = String((error as { code?: unknown })?.code ?? "");
    // EN DEV HAY LLAMADAS DUPLICADAS; SI CHOCA POR CONFLICT, REINTENTA LECTURA
    if (status === 409 || code === "23505") {
      const existing = await getProfileIdForFirebaseUid(firebaseUid);
      if (existing) return existing;
    }
    throw error;
  }
  const id = String(data ?? "");
  if (!isUuid(id)) throw invalidProfileIdFromRpcError();
  return id;
}

// ESTO CONVIERTE FIREBASE UID (TEXTO) A PROFILE ID (UUID) DE SUPABASE
export async function resolveSupabaseProfileId(userId: string, createIfMissing = true): Promise<string | null> {
  if (isUuid(userId)) return userId;
  if (!userId.trim()) return null;
  if (createIfMissing) return ensureProfileIdForFirebaseUid(userId);
  return getProfileIdForFirebaseUid(userId);
}

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

export async function fetchProfileByUserId(userId: string) {
  const dbUserId = await resolveSupabaseProfileId(userId, false);
  if (!dbUserId) return { profile: null as ProfileRow | null, error: invalidSupabaseUserIdError() };
  const { data, error } = await supabase.from("profiles").select("*").eq("id", dbUserId).maybeSingle();
  if (error) return { profile: null as ProfileRow | null, error };
  return { profile: data as ProfileRow | null, error: null as null };
}

export async function ensureProfileRow(userId: string) {
  let dbUserId = userId;
  try {
    const resolved = await resolveSupabaseProfileId(userId, true);
    if (!resolved) return { profile: null as ProfileRow | null, error: invalidSupabaseUserIdError() };
    dbUserId = resolved;
  } catch (error) {
    return { profile: null as ProfileRow | null, error: error as Error };
  }
  const { profile, error } = await fetchProfileByUserId(dbUserId);
  if (error) return { profile: null as ProfileRow | null, error };
  if (profile) return { profile, error: null as null };
  const { data, error: insErr } = await supabase.from("profiles").insert({ id: dbUserId }).select("*").single();
  if (insErr) {
    const code = String((insErr as { code?: unknown })?.code ?? "");
    if (code === "23503") {
      await signOut(auth);
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
  const dbUserId = await resolveSupabaseProfileId(userId, true);
  if (!dbUserId) return { data: null, error: invalidSupabaseUserIdError() };
  const row = { id: dbUserId, ...patch };
  return supabase.from("profiles").upsert(row, { onConflict: "id" });
}

export async function persistAvatar(file: File, userId: string) {
  const dbUserId = await resolveSupabaseProfileId(userId, true);
  if (!dbUserId) return { error: invalidSupabaseUserIdError() };
  // ESTO EVITA PROBLEMAS CON EXTENSIONES EN MAYUSCULA EN STORAGE
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${dbUserId}/avatar.${ext}`;
  const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (upErr) return { error: upErr };
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return upsertProfile(dbUserId, { avatar_url: data.publicUrl });
}

export async function wipeAccountAndSignOut() {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return { error: new Error("No session") };
  const dbUserId = await resolveSupabaseProfileId(user.uid, false);
  if (!dbUserId) {
    await signOut(auth);
    return {};
  }
  const { data: files } = await supabase.storage.from("avatars").list(dbUserId);
  if (files?.length) {
    await supabase.storage.from("avatars").remove(files.map((f) => `${dbUserId}/${f.name}`));
  }
  await supabase.from("profiles").delete().eq("id", dbUserId);
  await signOut(auth);
  return {};
}

export async function fetchWeeklyBudgetUsedPercent(userId: string): Promise<number> {
  const dbUserId = await resolveSupabaseProfileId(userId, false);
  if (!dbUserId) return 0;
  const { data, error } = await supabase
    .from("meal_plans")
    .select("id,start_date,end_date,budget,only_saved_recipes,only_new_recipes")
    .eq("user_id", dbUserId)
    .order("start_date", { ascending: true });
  if (error || !data?.length) return 0;

  const rows = data as Array<{
    id: string;
    start_date: string;
    end_date: string;
    budget: number | string | null;
    only_saved_recipes: boolean | null;
    only_new_recipes: boolean | null;
  }>;
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

  const budget = Number(row.budget ?? 0) || 0;
  if (!(budget > 0)) return 0;

  const { profile } = await fetchProfileByUserId(dbUserId);
  const restrictionValues = buildRestrictionValues(profile);
  const allergyKeywords = await fetchAllergyKeywords(restrictionValues);
  const avoid = profile ? buildAvoidKeywordSets(profile, allergyKeywords) : { allergyAvoid: new Set<string>(), dietAvoid: new Set<string>() };

  const { data: savedRows, error: savedErr } = await supabase
    .from("saved_recipes")
    .select("recipe_id")
    .eq("user_id", dbUserId);
  if (savedErr) return 0;
  const savedIdsArr = ((savedRows ?? []) as Array<{ recipe_id: string | null }>).map((r) => String(r.recipe_id ?? "")).filter(Boolean);

  const { data: dayRows, error: dayErr } = await supabase.from("meal_plan_days").select("date,weekday").eq("meal_plan_id", row.id);
  if (dayErr) return 0;

  const allFalse = { breakfast: false, lunch: false, dinner: false };
  const days: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const selections = {} as CreatePlanValues["selections"];
  for (const d of days) selections[d] = { ...allFalse };
  for (const d of (dayRows ?? []) as Array<{ weekday: string | null }>) {
    const wd = String(d.weekday ?? "").trim() as Weekday;
    if (!wd) continue;
    selections[wd] = { breakfast: true, lunch: true, dinner: true };
  }

  const values: CreatePlanValues = {
    budget,
    onlySavedRecipes: Boolean(row.only_saved_recipes),
    onlyNewRecipes: Boolean(row.only_new_recipes),
    selections,
  };

  const vm = await buildMealsForSlots({
    values,
    savedIdsArr,
    weekTitle: "Week",
    rangeStart: fromISODate(row.start_date),
    rangeEnd: fromISODate(row.end_date),
    avoid,
  });

  if (!(vm.budget > 0)) return 0;
  return Math.min(100, Math.round((vm.used / vm.budget) * 100));
}
