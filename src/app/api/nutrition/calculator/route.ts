import { fetchNutritionProxyJson } from "../../../../lib/nutritionfactsdata/server";

export const dynamic = "force-dynamic";

function getRequired(params: URLSearchParams, key: string) {
  const value = params.get(key)?.trim() ?? "";
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  const age = getRequired(params, "age");
  const gender = getRequired(params, "gender");
  const weight = getRequired(params, "weight");
  const height = getRequired(params, "height");
  const activity = getRequired(params, "activity");
  const goal = getRequired(params, "goal");

  if (!age || !gender || !weight || !height || !activity || !goal) {
    return Response.json(
      { error: "Missing one of: age, gender, weight, height, activity, goal" },
      { status: 400 },
    );
  }

  try {
    const data = await fetchNutritionProxyJson("calculator", { age, gender, weight, height, activity, goal });
    return Response.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return Response.json({ error: message }, { status: 502 });
  }
}

