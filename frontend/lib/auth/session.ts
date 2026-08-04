/**
 * Auth session I/O — PlatformUser via `sl_session` cookie (ADR-023 / 17.1.1.3).
 */

import { cookies } from "next/headers";

import {
  SESSION_COOKIE_NAME,
  type PlatformUserMe,
  platformUserToSummary,
} from "@/lib/auth/session-mapping";

export {
  SESSION_COOKIE_NAME,
  platformUserToSummary,
  type PlatformUserMe,
} from "@/lib/auth/session-mapping";

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export async function getMe(): Promise<PlatformUserMe | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const response = await fetch(`${apiBaseUrl()}/auth/me`, {
    headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
    cache: "no-store",
  });
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`Не удалось проверить сессию (${response.status}).`);
  }
  return (await response.json()) as PlatformUserMe;
}

function parseSessionToken(setCookieHeaders: string[]): string | null {
  for (const header of setCookieHeaders) {
    const match = header.match(
      new RegExp(`(?:^|,\\s*)${SESSION_COOKIE_NAME}=([^;\\s]+)`),
    );
    if (match?.[1]) return match[1];
  }
  return null;
}

export async function loginWithPassword(
  login: string,
  password: string,
): Promise<{ ok: true; user: PlatformUserMe } | { ok: false; message: string }> {
  const response = await fetch(`${apiBaseUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: login.trim(), password }),
    cache: "no-store",
  });
  if (!response.ok) {
    let message = "Неверный логин или пароль";
    try {
      const body = (await response.json()) as { detail?: string };
      if (typeof body.detail === "string" && body.detail.trim()) {
        message = body.detail;
      }
    } catch {
      // keep default
    }
    return { ok: false, message };
  }

  const userPayload = (await response.json()) as { user: PlatformUserMe };
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  const single = response.headers.get("set-cookie");
  const token =
    parseSessionToken(setCookies) ??
    (single ? parseSessionToken([single]) : null);
  if (!token) {
    return { ok: false, message: "Сервер не выдал сессионную cookie" };
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.AUTH_COOKIE_SECURE === "true",
    maxAge: 60 * 60 * 24,
  });
  return { ok: true, user: userPayload.user };
}

export async function logoutSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    try {
      await fetch(`${apiBaseUrl()}/auth/logout`, {
        method: "POST",
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
        cache: "no-store",
      });
    } catch {
      // Still clear local cookie.
    }
  }
  jar.delete(SESSION_COOKIE_NAME);
}
