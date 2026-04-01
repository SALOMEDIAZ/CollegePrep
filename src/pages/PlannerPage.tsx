import { useCallback, useEffect, useMemo, useState } from "react";
import supabase from "../services/supabaseClient";
import { getMealById, searchMealsByFirstLetter, type MealDbMeal } from "../services/api";
import CreatePlanModal, { type CreatePlanValues } from "../components/MealPlan/CreatePlanModal";
import MealPlan, { type MealPlanDay, type MealPlanMeal, type MealPlanViewModel, type MealType, type Weekday } from "../components/MealPlan/MealPlan";
import {
  ensureProfileRow,
  fetchAllergyKeywords,
  fetchDietaryKeywords,
  fetchSessionUser,
  type ProfileRow,
} from "../services/profileSupabase";
import "../styles/recipes.css";

type MealPlanRow = {
  id: string;
  user_id: string;
  name: string | null;
  start_date: string;
  end_date: string;
  budget: number | string | null;
  only_saved_recipes: boolean | null;
  only_new_recipes: boolean | null;
  created_at: string;
};

type SavedRecipeRow = {
  id: string;
  user_id: string;
  recipe_id: string;
  recipe_name: string | null;
  saved_at: string;
};

type IngredientRow = { id: number; name: string | null; price: number | string | null };
type IngredientIndex = {
  byNorm: Map<string, number>;
  list: Array<{ id: number; name: string; norm: string }>;
  priceById: Map<number, number>;
};

let ingredientIndexPromise: Promise<IngredientIndex> | null = null;

function normIngredientName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getIngredientIndex(): Promise<IngredientIndex> {
  if (ingredientIndexPromise) return ingredientIndexPromise;
  ingredientIndexPromise = (async () => {
    const { data, error } = await supabase.from("ingredients").select("id,name,price");
    if (error) throw error;
    const byNorm = new Map<string, number>();
    const list: IngredientIndex["list"] = [];
    const priceById = new Map<number, number>();
    for (const row of (data ?? []) as IngredientRow[]) {
      const name = String(row.name ?? "").trim();
      if (!name) continue;
      const norm = normIngredientName(name);
      if (!norm) continue;
      if (!byNorm.has(norm)) byNorm.set(norm, row.id);
      list.push({ id: row.id, name, norm });
      const price = Number(row.price ?? 0);
      if (Number.isFinite(price)) priceById.set(row.id, price);
    }
    return { byNorm, list, priceById };
  })();
  return ingredientIndexPromise;
}

function pickBestIngredientId(name: string, index: IngredientIndex) {
  const n = normIngredientName(name);
  if (!n) return null;
  const direct = index.byNorm.get(n);
  if (direct !== undefined) return direct;

  let best: { id: number; score: number } | null = null;
  for (const row of index.list) {
    if (row.norm === n) return row.id;
    const includes = row.norm.includes(n) || n.includes(row.norm);
    if (!includes) continue;
    const score = Math.abs(row.norm.length - n.length);
    if (!best || score < best.score) best = { id: row.id, score };
  }
  return best?.id ?? null;
}

function extractIngredientNames(meal: MealDbMeal | null) {
  const out: string[] = [];
  if (!meal) return out;
  for (let i = 1; i <= 20; i++) {
    const k = `strIngredient${i}`;
    const v = String((meal as unknown as Record<string, unknown>)[k] ?? "").trim();
    if (v) out.push(v);
  }
  return out;
}

async function computeMealCost(meal: MealDbMeal) {
  const names = extractIngredientNames(meal);
  if (!names.length) return 0;
  const index = await getIngredientIndex();
  const uniq = Array.from(new Set(names.map((n) => String(n).trim()))).filter(Boolean);
  const pickedIds = uniq
    .map((n) => pickBestIngredientId(n, index))
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
  const uniqueIds = Array.from(new Set(pickedIds));
  return uniqueIds.reduce((acc, id) => acc + Number(index.priceById.get(id) ?? 0), 0);
}

function startOfNextWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const delta = ((8 - day) % 7) || 7;
  x.setDate(x.getDate() + delta);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function fromISODate(s: string) {
  const [y, m, d] = s.split("-").map((x) => Number(x));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function addDaysISO(iso: string, delta: number) {
  const dt = fromISODate(iso);
  dt.setDate(dt.getDate() + delta);
  return toISODate(dt);
}

function formatDayTitle(iso: string) {
  const dt = fromISODate(iso);
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(dt);
  const md = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(dt);
  return `${wd}, ${md}`;
}

function formatWeekTitle(start: Date, end: Date) {
  const m = new Intl.DateTimeFormat("en-US", { month: "short" });
  return `Next week, ${m.format(start)} ${start.getDate()}-${end.getDate()}`;
}

function norm(s: string) {
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

function extractMealIngredientNames(meal: MealDbMeal) {
  const out: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const k = `strIngredient${i}`;
    const v = String((meal as unknown as Record<string, unknown>)[k] ?? "").trim();
    if (v) out.push(v);
  }
  return out;
}

function dietKeysFromProfile(profile: ProfileRow | null) {
  if (!profile) return [];
  const keys: string[] = [];
  if (profile.vegan) keys.push("vegan");
  else if (profile.vegetarian) keys.push("vegetarian");
  if (profile.gluten_free) keys.push("gluten_free");
  if (profile.lactose_free) keys.push("lactose_free");
  return keys;
}

async function buildRestrictionKeywordSets(profile: ProfileRow | null) {
  if (!profile) return { allergyAvoid: new Set<string>(), dietAvoid: new Set<string>() };
  const allergyValues = (Array.isArray(profile.allergies) ? profile.allergies : []).map((x) => String(x ?? ""));
  const dietKeys = dietKeysFromProfile(profile);
  const [allergyKeywords, dietKeywords] = await Promise.all([
    fetchAllergyKeywords(allergyValues),
    fetchDietaryKeywords(dietKeys),
  ]);

  const allergyAvoid = new Set<string>();
  for (const v of allergyValues) {
    const n = norm(String(v));
    if (n) allergyAvoid.add(n);
  }
  for (const kw of allergyKeywords) {
    const n = norm(String(kw));
    if (n) allergyAvoid.add(n);
  }

  const dietAvoid = new Set<string>();
  for (const k of dietKeys) {
    const n = norm(String(k));
    if (n) dietAvoid.add(n);
  }
  for (const kw of dietKeywords) {
    const n = norm(String(kw));
    if (n) dietAvoid.add(n);
  }

  return { allergyAvoid, dietAvoid };
}

function matchesAnyKeyword(text: string, keywords: Set<string>) {
  if (!keywords.size) return false;
  const t = norm(text);
  if (!t) return false;
  for (const k of keywords) {
    if (!k) continue;
    if (t === k) return true;
    if (t.includes(k)) return true;
  }
  return false;
}

function mealAllowedWithSets(meal: MealDbMeal, allergyAvoid: Set<string>, dietAvoid: Set<string>) {
  const ingredients = extractMealIngredientNames(meal);
  for (const ing of ingredients) {
    if (matchesAnyKeyword(ing, allergyAvoid)) return false;
    if (matchesAnyKeyword(ing, dietAvoid)) return false;
  }
  const title = String(meal.strMeal ?? "");
  const category = String(meal.strCategory ?? "");
  if (matchesAnyKeyword(title, allergyAvoid)) return false;
  if (matchesAnyKeyword(title, dietAvoid)) return false;
  if (matchesAnyKeyword(category, allergyAvoid)) return false;
  if (matchesAnyKeyword(category, dietAvoid)) return false;
  return true;
}

function weekdayFromDate(d: Date): Weekday {
  const map: Weekday[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const x = map[d.getDay()];
  return x === "Sun" ? "Sun" : x;
}

function sampleUnique<T>(items: T[], count: number) {
  if (count <= 0) return [];
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(count, arr.length));
}

function localPlanKey(userId: string, planId: string) {
  return `mealplan:${userId}:${planId}`;
}

function localLastPlanKey(userId: string) {
  return `mealplan:last:${userId}`;
}

async function fetchSavedRecipeIds(userId: string) {
  const { data, error } = await supabase.from("saved_recipes").select("recipe_id").eq("user_id", userId);
  if (error) throw error;
  const rows = (data ?? []) as Array<Pick<SavedRecipeRow, "recipe_id">>;
  return rows.map((r) => String(r.recipe_id)).filter(Boolean);
}

async function buildNewRecipePool(allergyAvoid: Set<string>, dietAvoid: Set<string>, minCount: number, excludeIds: Set<string>) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
  const pickedLetters = new Set<string>();
  const pool: string[] = [];
  const seen = new Set<string>();

  for (let round = 0; round < 10 && pool.length < minCount; round++) {
    const letters = sampleUnique(
      alphabet.filter((l) => !pickedLetters.has(l)),
      3,
    );
    if (!letters.length) break;
    letters.forEach((l) => pickedLetters.add(l));
    const lists = await Promise.all(letters.map((l) => searchMealsByFirstLetter(l)));
    for (const list of lists) {
      for (const m of list) {
        const id = String(m?.idMeal ?? "");
        if (!id) continue;
        if (excludeIds.has(id)) continue;
        if (seen.has(id)) continue;
        if (!mealAllowedWithSets(m, allergyAvoid, dietAvoid)) continue;
        seen.add(id);
        pool.push(id);
        if (pool.length >= minCount) break;
      }
      if (pool.length >= minCount) break;
    }
  }

  return pool;
}

async function resolveMealWithCost(mealId: string) {
  const m = await getMealById(mealId);
  if (!m) return null;
  const cost = await computeMealCost(m);
  return {
    recipeId: String(m.idMeal),
    recipeName: String(m.strMeal ?? m.idMeal),
    recipeThumb: m.strMealThumb ?? null,
    cost,
  };
}

function buildPlanViewModel(title: string, budget: number, days: MealPlanDay[]) {
  const used = days.flatMap((d) => d.meals).reduce((acc, m) => acc + Number(m.cost ?? 0), 0);
  const vm: MealPlanViewModel = { title, budget, used, days };
  return vm;
}

const MealPlanPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [plan, setPlan] = useState<MealPlanViewModel | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [plans, setPlans] = useState<MealPlanRow[]>([]);
  const [planIndex, setPlanIndex] = useState<number>(-1);
  const [viewMode, setViewMode] = useState<"week" | "day">("week");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const weekStart = useMemo(() => startOfNextWeek(new Date()), []);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekTitle = useMemo(() => formatWeekTitle(weekStart, weekEnd), [weekStart, weekEnd]);

  async function fetchAllPlans(uid: string) {
    const { data, error } = await supabase.from("meal_plans").select("*").eq("user_id", uid).order("start_date", { ascending: true });
    if (error) throw error;
    return (data ?? []) as MealPlanRow[];
  }

  function planTitleForRow(row: MealPlanRow) {
    const s = new Date(row.start_date);
    const e = new Date(row.end_date);
    const label = (() => {
      const now = new Date();
      if (now >= new Date(row.start_date) && now <= new Date(row.end_date)) return "This week";
      return "Week";
    })();
    const m = new Intl.DateTimeFormat("en-US", { month: "short" });
    return `${label}, ${m.format(s)} ${s.getDate()}-${e.getDate()}`;
  }

  function defaultSelectedDay(row: MealPlanRow) {
    const now = new Date();
    const s = new Date(row.start_date);
    const e = new Date(row.end_date);
    if (now >= s && now <= e) return toISODate(now);
    return row.start_date;
  }

  const loadPlanByIndex = useCallback(async (uid: string, rows: MealPlanRow[], idx: number) => {
    const row = rows[idx];
    if (!row) {
      setPlan(null);
      setPlanId(null);
      setSelectedDay(null);
      return;
    }
    const pid = row.id;
    setPlanId(pid);
    const key = localPlanKey(uid, pid);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as MealPlanViewModel;
      setPlan({ ...parsed, title: planTitleForRow(row) });
    } else {
      const budget = Number(row.budget ?? 0) || 0;
      setPlan({ title: planTitleForRow(row), budget, used: 0, days: [] });
    }
    setSelectedDay(defaultSelectedDay(row));
  }, []);

  useEffect(() => {
    let alive = true;
    async function run() {
      try {
        setLoading(true);
        setError(null);
        const u = await fetchSessionUser();
        if (!u) return;
        if (!alive) return;
        setUserId(u.id);
        const rows = await fetchAllPlans(u.id);
        if (!alive) return;
        setPlans(rows);
        if (!rows.length) {
          setPlan(null);
          setPlanId(null);
          setPlanIndex(-1);
          return;
        }
        // pick nearest upcoming, else last
        const todayIso = toISODate(new Date());
        let idx = rows.findIndex((r) => r.end_date >= todayIso);
        if (idx < 0) idx = rows.length - 1;
        setPlanIndex(idx);
        await loadPlanByIndex(u.id, rows, idx);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
        setPlan(null);
        setPlanId(null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [weekTitle, loadPlanByIndex]);

  async function createWeekPlan(values: CreatePlanValues) {
    if (!userId) return;
    try {
      setCreating(true);
      setError(null);

      const start = weekStart;
      const end = weekEnd;
      const startDate = toISODate(start);
      const endDate = toISODate(end);

      const { profile } = await ensureProfileRow(userId);
      const savedIdsArr = await fetchSavedRecipeIds(userId);
      const savedIds = new Set(savedIdsArr);

      const { allergyAvoid, dietAvoid } = await buildRestrictionKeywordSets(profile);
      const newPool = values.onlySavedRecipes
        ? []
        : await buildNewRecipePool(allergyAvoid, dietAvoid, 120, values.onlyNewRecipes ? savedIds : new Set<string>());

      const planRow = {
        user_id: userId,
        name: weekTitle,
        start_date: startDate,
        end_date: endDate,
        budget: values.budget,
        only_saved_recipes: values.onlySavedRecipes,
        only_new_recipes: values.onlyNewRecipes,
      };

      const { data: insertedPlan, error: insErr } = await supabase.from("meal_plans").insert(planRow).select("id").single();
      if (insErr) throw insErr;
      const pid = String(insertedPlan?.id ?? "");
      if (!pid) throw new Error("Failed to create meal plan");

      const daysRows: Array<{ meal_plan_id: string; date: string; weekday: string }> = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(start, i);
        const wd = weekdayFromDate(d);
        const anySelected = Object.values(values.selections[wd]).some(Boolean);
        if (!anySelected) continue;
        daysRows.push({ meal_plan_id: pid, date: toISODate(d), weekday: wd });
      }
      if (daysRows.length) {
        const { error: daysErr } = await supabase.from("meal_plan_days").insert(daysRows);
        if (daysErr) throw daysErr;
      }

      const slots: Array<{ date: string; weekday: Weekday; mealType: MealType }> = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(start, i);
        const wd = weekdayFromDate(d);
        const sel = values.selections[wd];
        (["breakfast", "lunch", "dinner"] as MealType[]).forEach((mt) => {
          if (sel[mt]) slots.push({ date: toISODate(d), weekday: wd, mealType: mt });
        });
      }

      const mealCache = new Map<string, Awaited<ReturnType<typeof resolveMealWithCost>>>();
      const usedRecipes = new Set<string>();
      let remaining = values.budget;

      async function getCached(mealId: string) {
        if (mealCache.has(mealId)) return mealCache.get(mealId) ?? null;
        const r = await resolveMealWithCost(mealId);
        mealCache.set(mealId, r);
        return r;
      }

      async function pickOne(): Promise<Awaited<ReturnType<typeof resolveMealWithCost>> | null> {
        const maxAttempts = 80;
        for (let i = 0; i < maxAttempts; i++) {
          const fromSaved =
            values.onlySavedRecipes || (!values.onlyNewRecipes && savedIdsArr.length > 0 && Math.random() < 0.4);

          const source = fromSaved ? savedIdsArr : newPool;
          if (!source.length) continue;
          const id = source[Math.floor(Math.random() * source.length)];
          if (!id) continue;
          if (usedRecipes.has(id)) continue;
          const resolved = await getCached(id);
          if (!resolved) continue;
          const c = Number(resolved.cost ?? 0);
          if (!Number.isFinite(c) || c <= 0) continue;
          if (c > remaining) continue;
          usedRecipes.add(id);
          remaining -= c;
          return resolved;
        }
        return null;
      }

      const dayMap = new Map<string, MealPlanDay>();
      for (const s of slots) {
        if (remaining <= 0) break;
        const picked = await pickOne();
        if (!picked) continue;
        const mealItem: MealPlanMeal = {
          mealType: s.mealType,
          recipeId: picked.recipeId,
          recipeName: picked.recipeName,
          recipeThumb: picked.recipeThumb,
          cost: picked.cost,
        };
        const key = s.date;
        const existing = dayMap.get(key);
        if (existing) {
          existing.meals.push(mealItem);
        } else {
          dayMap.set(key, { date: s.date, weekday: s.weekday, meals: [mealItem] });
        }
      }

      const days = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      const vm = buildPlanViewModel(weekTitle, values.budget, days);

      localStorage.setItem(localPlanKey(userId, pid), JSON.stringify(vm));
      localStorage.setItem(localLastPlanKey(userId), pid);
      setPlan(vm);
      setPlanId(pid);
      setModalOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  async function deleteCurrentPlan() {
    if (!userId || !planId) return;
    try {
      setDeleting(true);
      setError(null);
      const { error: daysErr } = await supabase.from("meal_plan_days").delete().eq("meal_plan_id", planId);
      if (daysErr) throw daysErr;
      const { error: planErr } = await supabase.from("meal_plans").delete().eq("id", planId).eq("user_id", userId);
      if (planErr) throw planErr;
      localStorage.removeItem(localPlanKey(userId, planId));
      localStorage.removeItem(localLastPlanKey(userId));
      const remaining = plans.filter((p) => p.id !== planId);
      setPlans(remaining);
      if (!remaining.length) {
        setPlan(null);
        setPlanId(null);
        setPlanIndex(-1);
        return;
      }
      const idx = Math.max(0, Math.min(planIndex, remaining.length - 1));
      setPlanIndex(idx);
      await loadPlanByIndex(userId, remaining, idx);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }

  const filteredPlan: MealPlanViewModel | null = useMemo(() => {
    if (!plan) return null;
    if (viewMode === "week") return plan;
    const day = selectedDay;
    if (!day) return plan;
    const existing = plan.days.find((d) => d.date === day);
    const dayVm: MealPlanDay = existing ?? { date: day, weekday: weekdayFromDate(fromISODate(day)), meals: [] };
    return { ...plan, days: [dayVm] };
  }, [plan, viewMode, selectedDay]);

  if (loading) return <div className="recipes-page"><div className="recipes-wrap"><p className="recipes-status">Loading…</p></div></div>;

  const currentRow = planIndex >= 0 ? plans[planIndex] : null;
  const headerTitle =
    viewMode === "day" && selectedDay ? formatDayTitle(selectedDay) : plan?.title ?? currentRow?.name ?? weekTitle;

  const canGoPrev =
    plans.length > 0 &&
    (viewMode === "week"
      ? planIndex > 0
      : !!currentRow && !!selectedDay && (selectedDay > currentRow.start_date || planIndex > 0));

  const canGoNext =
    plans.length > 0 &&
    (viewMode === "week"
      ? planIndex >= 0 && planIndex < plans.length - 1
      : !!currentRow && !!selectedDay && (selectedDay < currentRow.end_date || planIndex < plans.length - 1));

  async function gotoPrevNext(delta: number) {
    if (!userId) return;
    if (viewMode === "week") {
      const newIdx = planIndex + delta;
      if (newIdx < 0 || newIdx >= plans.length) return;
      setPlanIndex(newIdx);
      await loadPlanByIndex(userId, plans, newIdx);
      return;
    }
    if (!currentRow || !selectedDay) return;
    const next = addDaysISO(selectedDay, delta);
    if (next >= currentRow.start_date && next <= currentRow.end_date) {
      setSelectedDay(next);
      return;
    }
    const newPlanIndex = planIndex + delta;
    if (newPlanIndex < 0 || newPlanIndex >= plans.length) return;
    setPlanIndex(newPlanIndex);
    await loadPlanByIndex(userId, plans, newPlanIndex);
    const target = delta < 0 ? plans[newPlanIndex].end_date : plans[newPlanIndex].start_date;
    setSelectedDay(target);
  }

  return (
    <div className="recipes-page mp-page">
      <div className="recipes-wrap mp-wrap">
        {error ? <p className="recipes-error">{error}</p> : null}

        <div className="mp-navRow">
          <button type="button" className="mp-arrowBtn" onClick={() => gotoPrevNext(-1)} disabled={!canGoPrev}>
            ‹
          </button>
          <div className="mp-navTitle">{headerTitle}</div>
          <button type="button" className="mp-arrowBtn" onClick={() => gotoPrevNext(1)} disabled={!canGoNext}>
            ›
          </button>
        </div>
        <div className="mp-segment">
          <button
            type="button"
            className={`mp-segBtn ${viewMode === "day" ? "mp-segBtn--active" : ""}`}
            onClick={() => {
              setViewMode("day");
              if (currentRow && !selectedDay) setSelectedDay(defaultSelectedDay(currentRow));
            }}
          >
            Day
          </button>
          <button
            type="button"
            className={`mp-segBtn ${viewMode === "week" ? "mp-segBtn--active" : ""}`}
            onClick={() => setViewMode("week")}
          >
            Week
          </button>
        </div>

        {!plan ? (
          <div className="mp-empty">
            <button type="button" className="mp-primaryBtn" onClick={() => setModalOpen(true)}>
              Create week plan
            </button>
          </div>
        ) : filteredPlan ? (
          <div>
            <MealPlan plan={filteredPlan} />
            <div className="mp-bottomActions">
              <button type="button" className="mp-dangerBtn" disabled={creating || deleting} onClick={deleteCurrentPlan}>
                Delete plan
              </button>
            </div>
          </div>
        ) : null}

        <CreatePlanModal
          open={modalOpen}
          title={weekTitle}
          initialBudget={300000}
          onClose={() => (creating ? null : setModalOpen(false))}
          onCreate={createWeekPlan}
        />
        {creating ? <p className="recipes-status">Creating plan…</p> : null}
      </div>
    </div>
  );
};

export default MealPlanPage;
