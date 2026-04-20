"use client";

// Client wrapper around our Next.js route handlers to avoid browser CORS issues.
const BASE_URL = "/api/nutrition";

export type NutritionFactsFoodHit = {
  name: string;
  description?: string;
};

export type NutritionFactsFood = {
  name: string;
  serving?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  raw: unknown;
};

export type NutritionFactsCompareResult = {
  food1: NutritionFactsFood;
  food2: NutritionFactsFood;
  raw: unknown;
};

export type NutritionFactsCalculatorResult = {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  raw: unknown;
};

function numberOrNull(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function pickFirstString(obj: Record<string, unknown>, keys: string[]) {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function pickFirstNumber(obj: Record<string, unknown>, keys: string[]) {
  for (const k of keys) {
    const v = obj[k];
    const n = numberOrNull(v);
    if (n !== null) return n;
    if (typeof v === "string") {
      const parsed = Number(v);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function cleanFoodName(raw: string) {
  let s = raw.trim();
  if (!s) return s;

  // Common patterns from the upstream API.
  // Example: "Calories in a Chipotle Burrito Bowl 2026" -> "Chipotle Burrito Bowl"
  s = s.replace(/^\s*calories in (an?|the)\s+/i, "");
  s = s.replace(/^\s*calories in\s+/i, "");
  s = s.replace(/^\s*nutrition facts (for|of)\s+/i, "");
  s = s.replace(/\s+\d{4}\s*$/i, "");
  s = s.replace(/\s+\(.*?\)\s*$/i, "").trim();

  return s;
}

function normalizeHit(item: unknown): NutritionFactsFoodHit | null {
  if (!item) return null;
  if (typeof item === "string") return { name: item };
  if (typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;
  const nameRaw = pickFirstString(obj, ["name", "title", "food", "label", "text"]);
  const name = cleanFoodName(nameRaw);
  if (!name) return null;
  const description = pickFirstString(obj, ["description", "desc", "subtitle"]);
  return { name, description: description || undefined };
}

function normalizeFood(data: unknown, fallbackName: string, serving: string): NutritionFactsFood {
  if (!data || typeof data !== "object") {
    return { name: fallbackName, serving, raw: data };
  }

  const obj = data as Record<string, unknown>;
  const name = pickFirstString(obj, ["name", "food", "title"]) || fallbackName;
  const servingOut = pickFirstString(obj, ["serving", "portion", "amount"]) || serving;

  const calories =
    pickFirstNumber(obj, ["calories", "kcal", "energy_kcal", "energy", "cal"]) ?? undefined;
  const protein = pickFirstNumber(obj, ["protein", "protein_g"]) ?? undefined;
  const carbs = pickFirstNumber(obj, ["carbs", "carbohydrates", "carbs_g", "carbohydrates_g"]) ?? undefined;
  const fat = pickFirstNumber(obj, ["fat", "fat_g", "total_fat"]) ?? undefined;

  return { name, serving: servingOut, calories, protein, carbs, fat, raw: data };
}

async function getJson(url: string, signal?: AbortSignal) {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const contentType = res.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "");
    const message =
      typeof body === "string"
        ? body
        : body && typeof body === "object"
          ? String((body as { error?: unknown; message?: unknown }).error ?? (body as { message?: unknown }).message ?? "")
          : "";
    throw new Error(message || `Request failed (${res.status})`);
  }
  return res.json() as Promise<unknown>;
}

export async function searchFoods(q: string, limit = 10, signal?: AbortSignal) {
  const url =
    `${BASE_URL}/search?` +
    new URLSearchParams({ q: q.trim(), limit: String(limit) }).toString();

  const data = await getJson(url, signal);

  const rawList =
    Array.isArray(data)
      ? data
      : data && typeof data === "object"
        ? ((data as Record<string, unknown>).results ??
            (data as Record<string, unknown>).items ??
            (data as Record<string, unknown>).foods ??
            (data as Record<string, unknown>).data)
        : null;

  const list = Array.isArray(rawList) ? rawList : [];
  const hits = list.map(normalizeHit).filter((x): x is NutritionFactsFoodHit => Boolean(x));

  // Some endpoints return duplicates; keep the first instance by normalized name.
  const seen = new Set<string>();
  const unique: NutritionFactsFoodHit[] = [];
  for (const h of hits) {
    const k = h.name.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    unique.push(h);
  }

  const query = cleanFoodName(q).trim().toLowerCase();
  const score = (name: string) => {
    const n = name.trim().toLowerCase();
    if (!query) return 50;
    if (n === query) return 0;
    if (n.startsWith(query)) return 5;
    if (n.includes(query)) return 10;
    return 25;
  };

  return unique.sort((a, b) => {
    const sa = score(a.name);
    const sb = score(b.name);
    if (sa !== sb) return sa - sb;
    return a.name.length - b.name.length;
  });
}

export async function getFood(name: string, serving = "100g", signal?: AbortSignal) {
  const url =
    `${BASE_URL}/food?` +
    new URLSearchParams({ name: name.trim(), serving: serving.trim() }).toString();
  const data = await getJson(url, signal);
  return normalizeFood(data, name, serving);
}

function normalizeCompare(data: unknown, food1: string, food2: string): NutritionFactsCompareResult {
  if (!data) {
    return {
      food1: { name: food1, raw: data },
      food2: { name: food2, raw: data },
      raw: data,
    };
  }

  if (Array.isArray(data)) {
    const a = data.length > 0 ? data[0] : null;
    const b = data.length > 1 ? data[1] : null;
    return { food1: normalizeFood(a, food1, "100g"), food2: normalizeFood(b, food2, "100g"), raw: data };
  }

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (obj.food1 || obj.food2) {
      return {
        food1: normalizeFood(obj.food1, food1, "100g"),
        food2: normalizeFood(obj.food2, food2, "100g"),
        raw: data,
      };
    }
    const maybeList = obj.results ?? obj.items ?? obj.data;
    if (Array.isArray(maybeList)) {
      const a = maybeList.length > 0 ? maybeList[0] : null;
      const b = maybeList.length > 1 ? maybeList[1] : null;
      return { food1: normalizeFood(a, food1, "100g"), food2: normalizeFood(b, food2, "100g"), raw: data };
    }
  }

  return {
    food1: normalizeFood(null, food1, "100g"),
    food2: normalizeFood(null, food2, "100g"),
    raw: data,
  };
}

export async function compareFoods(food1: string, food2: string, signal?: AbortSignal) {
  const url =
    `${BASE_URL}/compare?` + new URLSearchParams({ food1: food1.trim(), food2: food2.trim() }).toString();
  const data = await getJson(url, signal);
  return normalizeCompare(data, food1, food2);
}

function normalizeCalculator(data: unknown): NutritionFactsCalculatorResult {
  if (!data || typeof data !== "object") return { raw: data };
  const obj = data as Record<string, unknown>;
  const calories = pickFirstNumber(obj, ["calories", "kcal", "tdee", "maintenanceCalories", "maintenance_calories"]) ?? undefined;
  const protein = pickFirstNumber(obj, ["protein", "protein_g"]) ?? undefined;
  const carbs = pickFirstNumber(obj, ["carbs", "carbohydrates", "carbs_g", "carbohydrates_g"]) ?? undefined;
  const fat = pickFirstNumber(obj, ["fat", "fat_g", "total_fat"]) ?? undefined;
  return { calories, protein, carbs, fat, raw: data };
}

export async function calculateNeeds(
  params: { age: string; gender: string; weight: string; height: string; activity: string; goal: string },
  signal?: AbortSignal,
) {
  const url = `${BASE_URL}/calculator?` + new URLSearchParams(params).toString();
  const data = await getJson(url, signal);
  return normalizeCalculator(data);
}

export function formatMacroLabelSafe(value?: number, suffix = "g") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 10) / 10}${suffix}`;
}

export function formatCaloriesSafe(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}`;
}

export function formatMacroLabel(value?: number, suffix = "g") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 10) / 10}${suffix}`;
}

export function formatCalories(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}`;
}
