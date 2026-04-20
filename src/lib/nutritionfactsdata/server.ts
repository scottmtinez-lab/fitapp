const EXTERNAL_BASE_URL = "https://nutritionfactsdata.com/wp-json/nutritiondata/v1";

export type NutritionProxyEndpoint = "search" | "food" | "compare" | "calculator";

export async function fetchNutritionProxyJson(
  endpoint: NutritionProxyEndpoint,
  params: Record<string, string>,
  init?: RequestInit,
) {
  const url = `${EXTERNAL_BASE_URL}/${endpoint}?${new URLSearchParams(params).toString()}`;

  const res = await fetch(url, {
    cache: "no-store",
    ...init,
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  if (!res.ok) {
    const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "");
    const msg =
      typeof body === "string"
        ? body
        : body && typeof body === "object" && "message" in body
          ? String((body as { message?: unknown }).message ?? "")
          : "";
    throw new Error(msg || `Nutrition API failed (${res.status})`);
  }

  return (await res.json()) as unknown;
}

