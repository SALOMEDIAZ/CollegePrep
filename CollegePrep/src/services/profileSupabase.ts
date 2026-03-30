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

export async function fetchSessionUser() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
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
  if (insErr) return { profile: null as ProfileRow | null, error: insErr };
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
