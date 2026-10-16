"use server";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import { readPlatformHealth, type PlatformHealthView } from "@/lib/platform-debug";

export type PlatformHealthLoadResult =
  | { ok: true; health: PlatformHealthView }
  | { ok: false; message: string };

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
  } catch {
    /* ignore */
  }
  if (response.status === 401) return "Требуется вход";
  if (response.status === 403) return "Недостаточно прав для просмотра диагностики платформы";
  return `Ошибка API (${response.status})`;
}

export async function loadPlatformHealth(input: {
  category?: string | null;
  module?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  offset?: number;
}): Promise<PlatformHealthLoadResult> {
  const params = new URLSearchParams();
  if (input.category) params.set("category", input.category);
  if (input.module) params.set("module", input.module);
  if (input.entityType) params.set("entity_type", input.entityType);
  if (input.entityId) params.set("entity_id", input.entityId);
  params.set("limit", "200");
  params.set("offset", String(input.offset ?? 0));
  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/platform-health?${params.toString()}`, {
    headers: { ...auth },
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, message: await readError(response) };
  const health = readPlatformHealth(await response.json());
  if (!health) return { ok: false, message: "Ответ диагностики не распознан" };
  return { ok: true, health };
}
