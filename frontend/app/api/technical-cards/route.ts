import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const limit = request.nextUrl.searchParams.get("limit") ?? "";
  const offset = request.nextUrl.searchParams.get("offset") ?? "0";
  if (!/^\d+$/.test(limit) || !/^\d+$/.test(offset) || Number(limit) < 1 || Number(limit) > 500 || Number(offset) > 4500) {
    return NextResponse.json({ detail: "Некорректный список техкарт" }, { status: 400 });
  }
  const base = (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  try {
    const upstream = await fetch(`${base}/technical-cards?limit=${limit}&offset=${offset}`, {
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
