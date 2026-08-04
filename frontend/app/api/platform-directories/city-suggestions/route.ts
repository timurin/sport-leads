import { sessionAuthHeaders } from "@/lib/auth/api-headers";

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const limit = Number.parseInt(searchParams.get("limit") ?? "8", 10);

  if (query.length < 2) {
    return Response.json([]);
  }

  const backendParams = new URLSearchParams();
  backendParams.set("q", query);
  backendParams.set("is_active", "true");
  backendParams.set(
    "limit",
    String(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 20) : 8),
  );
  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/platform-directories/cities?${backendParams.toString()}`,
    {
      headers: { ...auth },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    let detail = `API error (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (typeof body.detail === "string" && body.detail.trim()) {
        detail = body.detail;
      }
    } catch {
      // Keep status-based message.
    }
    return Response.json({ detail }, { status: response.status });
  }

  const cities = (await response.json()) as Array<{ name: string }>;
  return Response.json(cities.map((city) => ({ name: city.name })));
}
