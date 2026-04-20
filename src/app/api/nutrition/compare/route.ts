import { fetchNutritionProxyJson } from "../../../../lib/nutritionfactsdata/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const food1 = url.searchParams.get("food1")?.trim() ?? "";
  const food2 = url.searchParams.get("food2")?.trim() ?? "";

  if (!food1 || !food2) {
    return Response.json({ error: "Missing food1 or food2" }, { status: 400 });
  }

  try {
    const data = await fetchNutritionProxyJson("compare", { food1, food2 });
    return Response.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return Response.json({ error: message }, { status: 502 });
  }
}

