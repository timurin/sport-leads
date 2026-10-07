import { NextRequest, NextResponse } from "next/server";

type Context = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: Context) {
  const { path } = await context.params;
  const suffix = path.join("/");
  const method = request.method;
  const capacityKey = "[a-z0-9_]+";
  const capacityDay = "\\d{4}-\\d{2}-\\d{2}";
  const valid = (method === "GET" && (suffix === "board" || suffix === "sources" || suffix === "capacity/settings")) ||
    (method === "POST" && (suffix === "assignments" || suffix === "capacity/load-state")) ||
    ((method === "PUT" || method === "DELETE") && /^assignments\/\d+$/.test(suffix)) ||
    (method === "PUT" && new RegExp(`^capacity/settings/${capacityKey}$`).test(suffix)) ||
    ((method === "PUT" || method === "DELETE") && new RegExp(`^capacity/settings/${capacityKey}/exceptions/${capacityDay}$`).test(suffix));
  if (!valid) return NextResponse.json({ detail: "Неизвестный маршрут календаря" }, { status: 404 });
  const origin = request.headers.get("origin");
  if (method !== "GET" && origin && origin !== "http://" + request.headers.get("host") && origin !== "https://" + request.headers.get("host")) {
    return NextResponse.json({ detail: "Недопустимый источник запроса" }, { status: 403 });
  }
  const base = (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  try {
    const upstream = await fetch(base + "/production-calendar/" + suffix + request.nextUrl.search, {
      method, cache: "no-store",
      headers: { Cookie: request.headers.get("cookie") ?? "", "Content-Type": "application/json" },
      body: method === "POST" || method === "PUT" ? await request.text() : undefined,
      signal: AbortSignal.timeout(15000),
    });
    return new NextResponse(upstream.status === 204 ? null : await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ detail: "Не удалось связаться с API календаря" }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;

