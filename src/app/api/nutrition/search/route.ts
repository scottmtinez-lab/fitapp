import { fetchNutritionProxyJson } from "../../../../lib/nutritionfactsdata/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limitRaw = url.searchParams.get("limit") ?? "10";
  const limit = Math.max(1, Math.min(25, Number(limitRaw) || 10));

  if (!q) {
    return Response.json({ error: "Missing q" }, { status: 400 });
  }

  try {
    const data = await fetchNutritionProxyJson("search", { q, limit: String(limit) });
    return Response.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return Response.json({ error: message }, { status: 502 });
  }
}

