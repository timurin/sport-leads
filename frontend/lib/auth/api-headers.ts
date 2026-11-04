/**
 * Forward Next `sl_session` cookie to backend API calls (ADR-023).
 */

import "server-only";

import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME } from "@/lib/auth/session-mapping";

export async function sessionAuthHeaders(): Promise<Record<string, string>> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return {};
  return { Cookie: `${SESSION_COOKIE_NAME}=${token}` };
}

export async function sessionRequestHeaders(
  extra?: HeadersInit,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...(await sessionAuthHeaders()) };
  if (!extra) return headers;
  new Headers(extra).forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

export async function readApiDetail(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
  } catch {
    /* keep the fallback */
  }
  if (response.status === 401) return "Требуется вход";
  return fallback;
}
