import type { MealDbMeal } from "./api";
import type { ProfileRow } from "../types/profile";
import type { CategoryFilter } from "../types/recipes";

const CATEGORY_MAP: Record<CategoryFilter, string[]> = {
  Breakfast: ["Breakfast"],
  Lunch: ["Side", "Starter", "Vegetarian", "Vegan", "Miscellaneous"],
  Dinner: ["Beef", "Chicken", "Lamb", "Pork", "Seafood", "Pasta", "Goat"],
};

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractMealIngredientNames(meal: MealDbMeal) {
  const ingredients: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const value = String(
      (meal as unknown as Record<string, unknown>)[`strIngredient${i}`] ?? "",
    ).trim();
    if (value) ingredients.push(value);
  }
  return ingredients;
}

export function getDietRestrictions(profile: ProfileRow | null) {
  if (!profile) return [];
  const restrictions: string[] = [];
  if (profile.vegan) restrictions.push("vegan");
  else if (profile.vegetarian) restrictions.push("vegetarian");
  if (profile.gluten_free) restrictions.push("gluten_free", "gluten");
  if (profile.lactose_free) restrictions.push("lactose_free", "lactose");
  return restrictions;
}

export function getFallbackKeywords(dietRestrictions: string[]) {
  const isVegetarian =
    dietRestrictions.includes("vegan") ||
    dietRestrictions.includes("vegetarian");
  if (!isVegetarian) return [];
  const meatKeywords = [
    "meat",
    "beef",
    "pork",
    "chicken",
    "turkey",
    "lamb",
    "fish",
    "seafood",
    "shrimp",
  ];
  const veganKeywords = [
    "egg",
    "milk",
    "cheese",
    "butter",
    "cream",
    "yogurt",
    "honey",
  ];
  return dietRestrictions.includes("vegan")
    ? [...meatKeywords, ...veganKeywords]
    : meatKeywords;
}

export function matchesKeyword(text: string, keywords: string[]) {
  const normalized = norm(text);
  if (!normalized) return false;
  return keywords.some(
    (kw) => normalized === norm(kw) || normalized.includes(norm(kw)),
  );
}

export function isMealAllowed(meal: MealDbMeal, forbiddenKeywords: string[]) {
  if (!forbiddenKeywords.length) return true;

  const ingredients = extractMealIngredientNames(meal);
  const title = String(meal.strMeal ?? "");
  const category = String(meal.strCategory ?? "");
  const textToCheck = [...ingredients, title, category];

  return !textToCheck.some((text) => matchesKeyword(text, forbiddenKeywords));
}

function extractMinutesFromText(text: string) {
  const minutes: number[] = [];
  const add = (n: number) => {
    if (Number.isFinite(n) && n > 0) minutes.push(n);
  };

  const rangeMin = /(\d+)\s*[-–]\s*(\d+)\s*(?:mins?|minutes?)\b/gi;
  for (const m of text.matchAll(rangeMin)) add(Number(m[2]));

  const singleMin = /(\d+)\s*(?:mins?|minutes?)\b/gi;
  for (const m of text.matchAll(singleMin)) add(Number(m[1]));

  const singleHr = /(\d+)\s*(?:h|hr|hrs|hour|hours)\b/gi;
  for (const m of text.matchAll(singleHr)) add(Number(m[1]) * 60);

  return minutes;
}

export function getTimeLabels(meal: MealDbMeal | null) {
  const tagsRaw = meal
    ? String((meal as unknown as { strTags?: unknown }).strTags ?? "")
    : "";
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const noCook = tags.includes("nocook");

  const instructions = meal ? String(meal.strInstructions ?? "") : "";
  const times = instructions ? extractMinutesFromText(instructions) : [];

  const fallbackPrep = "10 minutes to prep";
  const fallbackCook = noCook ? "No cooking time" : "Cooking time varies";

  if (!times.length)
    return { prepLabel: fallbackPrep, cookLabel: fallbackCook };

  const min = Math.min(...times);
  const max = Math.max(...times);

  if (noCook)
    return {
      prepLabel: `${min} minutes to prep`,
      cookLabel: "No cooking time",
    };

  if (times.length === 1) {
    if (min <= 20)
      return { prepLabel: `${min} minutes to prep`, cookLabel: fallbackCook };
    return {
      prepLabel: fallbackPrep,
      cookLabel: `${min} minutes cooking time`,
    };
  }

  if (min === max)
    return {
      prepLabel: `${min} minutes to prep`,
      cookLabel: `${max} minutes cooking time`,
    };
  return {
    prepLabel: `${min} minutes to prep`,
    cookLabel: `${max} minutes cooking time`,
  };
}

export function extractIngredients(meal: MealDbMeal | null) {
  const items: Array<{ name: string; measure: string }> = [];
  if (!meal) return items;
  for (let i = 1; i <= 20; i++) {
    const nameKey = `strIngredient${i}` as keyof MealDbMeal;
    const measureKey = `strMeasure${i}` as keyof MealDbMeal;
    const name = String(meal[nameKey] ?? "").trim();
    if (!name) continue;
    const measure = String(meal[measureKey] ?? "").trim();
    items.push({ name, measure });
  }
  return items;
}

export function titleParts(title: string) {
  const t = String(title || "").trim();
  const i = t.indexOf(" ");
  if (i <= 0) return { first: t, rest: "" };
  return { first: t.slice(0, i), rest: t.slice(i + 1) };
}

export function splitSteps(instructions: string | null) {
  const raw = String(instructions ?? "").trim();
  if (!raw) return [];
  const MAX_STEP_CHARS = 220;
  const isOnlyNumber = (s: string) => /^\d+\s*[.)-]?\s*$/.test(s);
  const stripLeadingNumber = (s: string) =>
    s.replace(/^\s*\d+\s*[.)-]?\s*/g, "").trim();
  const isJunk = (s: string) =>
    !s || isOnlyNumber(s) || /^[\W_]+$/.test(s) || /\bstep\b/i.test(s);
  const splitSentences = (s: string) =>
    s
      .split(/(?<=[.!?])\s+/g)
      .map((t) => t.trim())
      .filter(Boolean);

  const hardWrap = (s: string) => {
    const out: string[] = [];
    let rest = s.trim();
    while (rest.length > MAX_STEP_CHARS) {
      const head = rest.slice(0, MAX_STEP_CHARS + 1);
      const cutAt = Math.max(head.lastIndexOf(" "), head.lastIndexOf("-"));
      const cut = cutAt >= 40 ? cutAt : MAX_STEP_CHARS;
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
    return out;
  };

  const splitLongStep = (s: string) => {
    const clean = s.trim();
    if (!clean) return [];
    if (clean.length <= MAX_STEP_CHARS) return [clean];
    const pieces = splitSentences(clean);
    const base =
      pieces.length > 1
        ? pieces
        : clean
            .split(/[;,]\s+/g)
            .map((t) => t.trim())
            .filter(Boolean);
    const chunks: string[] = [];
    let cur = "";
    for (const p of base) {
      if (!cur) {
        cur = p;
        continue;
      }
      if (`${cur} ${p}`.length <= MAX_STEP_CHARS) {
        cur = `${cur} ${p}`;
      } else {
        chunks.push(cur);
        cur = p;
      }
    }
    if (cur) chunks.push(cur);
    const expanded = chunks.flatMap((c) =>
      c.length > MAX_STEP_CHARS ? hardWrap(c) : [c],
    );
    return expanded.map((x) => x.trim()).filter(Boolean);
  };

  const normalizeBrokenLines = (lines: string[]) => {
    const normalized: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const prevIndex = normalized.length - 1;
      const prev = normalized[prevIndex] ?? "";
      const isShortLine = trimmed.split(/\s+/).length <= 4;
      const isStepLabel = /^\s*step\b/i.test(trimmed);
      const prevEndsSentence = /[.!?;:]$/.test(prev);
      const prevLooksLikeStepLabel = /^\s*step\b/i.test(prev);
      if (
        normalized.length &&
        isShortLine &&
        !isStepLabel &&
        !isOnlyNumber(trimmed) &&
        !prevEndsSentence &&
        !prevLooksLikeStepLabel
      ) {
        normalized[prevIndex] = `${prev} ${trimmed}`.trim();
      } else {
        normalized.push(trimmed);
      }
    }
    return normalized;
  };

  const rawLines = normalizeBrokenLines(
    raw
      .split(/\r?\n+/g)
      .map((s) => s.trim())
      .filter(Boolean),
  );

  if (rawLines.length > 1) {
    const steps: string[] = [];
    for (const line of rawLines) {
      if (isOnlyNumber(line)) continue;
      const cleaned = stripLeadingNumber(line);
      if (isJunk(cleaned)) continue;
      steps.push(...splitLongStep(cleaned));
    }
    if (steps.length) return Array.from(new Set(steps.map((s) => s.trim())));
  }

  const sentences = splitSentences(raw)
    .map((s) => stripLeadingNumber(s.trim()))
    .flatMap((s) => splitLongStep(s))
    .filter((s) => !isJunk(s));

  if (!sentences.length) return [];
  return Array.from(new Set(sentences.map((s) => s.trim())));
}

export function filterByCategory(
  meals: MealDbMeal[],
  activeCategory: CategoryFilter | null,
) {
  if (!activeCategory) return meals;
  const allowed = CATEGORY_MAP[activeCategory].map((c) => c.toLowerCase());
  return meals.filter((m) =>
    allowed.includes(String(m.strCategory ?? "").toLowerCase()),
  );
}
