import { NextRequest, NextResponse } from "next/server";

type Context = { params: Promise<{ cardId: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { cardId } = await context.params;
  if (!/^[1-9]\d*$/.test(cardId)) {
    return NextResponse.json({ detail: "Техкарта не найдена" }, { status: 404 });
  }
  const base = (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  try {
    const upstream = await fetch(`${base}/technical-cards/${cardId}/planning-health`, {
      cache: "no-store",
      headers: { Cookie: request.headers.get("cookie") ?? "" },
      signal: AbortSignal.timeout(15000),
    });
    return new NextResponse(upstream.status === 204 ? null : await upstream.text(), {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ detail: "Не удалось связаться с API" }, { status: 502 });
  }
}
