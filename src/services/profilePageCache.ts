import type { ProfileRow } from "../types/profile";

const STORAGE_KEY = "cp_profile_page_v1";
const TTL_MS = 10 * 60 * 1000;

type ProfilePageCacheEntry = {
  uid: string;
  dbUserId: string;
  profile: ProfileRow;
  budgetPct: number | null;
  at: number;
};

export function readProfilePageCache(uid: string): ProfilePageCacheEntry | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProfilePageCacheEntry;
    if (!parsed || parsed.uid !== uid) return null;
    if (Date.now() - parsed.at > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeProfilePageCache(entry: Omit<ProfilePageCacheEntry, "at">) {
  try {
    const payload: ProfilePageCacheEntry = { ...entry, at: Date.now() };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    return;
  }
}

export function clearProfilePageCache() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}
