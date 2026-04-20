import { fetchNutritionProxyJson } from "../../../../lib/nutritionfactsdata/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = url.searchParams.get("name")?.trim() ?? "";
  const serving = url.searchParams.get("serving")?.trim() ?? "100g";

  if (!name) {
    return Response.json({ error: "Missing name" }, { status: 400 });
  }

  try {
    const data = await fetchNutritionProxyJson("food", { name, serving });
    return Response.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return Response.json({ error: message }, { status: 502 });
  }
}

