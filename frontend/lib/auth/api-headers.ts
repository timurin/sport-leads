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
