import "server-only";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import {
  readAppliedWorkshopQueue,
  readQueueConflict,
  readWorkshopQueue,
  readWorkshopQueuePreview,
  workshopQueueHttpMessage,
  type WorkshopQueuePreviewView,
  type WorkshopQueueSection,
} from "@/lib/production/workshop-queue";

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

export type WorkshopQueueCall<T> =
  | { ok: true; data: T }
  | {
    ok: false;
    status: number;
    code: string | null;
    message: string;
    stale: boolean;
    diagnostic: Record<string, unknown> | null;
  };

async function readFailure(response: Response): Promise<Extract<WorkshopQueueCall<never>, { ok: false }>> {
  const body = await response.json().catch(() => null);
  const conflict = readQueueConflict(body, response.headers.get("x-diagnostic-code"));
  return {
    ok: false,
    status: response.status,
    code: conflict.code,
    message: workshopQueueHttpMessage(response.status, conflict),
    stale: conflict.stale,
    diagnostic: conflict.diagnostic,
  };
}

export async function loadWorkshopQueues(workshopIds: readonly number[]): Promise<
  | { ok: true; sections: WorkshopQueueSection[] }
  | { ok: false; message: string; stale: boolean; diagnostic: Record<string, unknown> | null }
> {
  const auth = await sessionAuthHeaders();
  const unique = [...new Set(workshopIds.filter((id) => Number.isInteger(id) && id > 0))];
  const responses = await Promise.all(unique.map(async (workshopId) => {
    const response = await fetch(`${apiBaseUrl()}/production-calendar/workshops/${workshopId}/queue`, {
      headers: auth,
      cache: "no-store",
    });
    return { workshopId, response };
  }));
  const sections: WorkshopQueueSection[] = [];
  for (const { response } of responses) {
    if (response.status === 404) continue;
    if (!response.ok) {
      const failure = await readFailure(response);
      return { ok: false, message: failure.message, stale: failure.stale, diagnostic: failure.diagnostic };
    }
    const parsed = readWorkshopQueue(await response.json());
    if (!parsed) {
      return { ok: false, message: "Сервер вернул очередь в неожиданном виде.", stale: false, diagnostic: null };
    }
    sections.push(parsed);
  }
  sections.sort((left, right) => left.workshopId - right.workshopId);
  return { ok: true, sections };
}

export async function postWorkshopQueuePreview(
  workshopId: number,
  body: { revision: string; ordered_snapshot_node_ids: number[] },
): Promise<WorkshopQueueCall<WorkshopQueuePreviewView>> {
  const response = await fetch(`${apiBaseUrl()}/production-calendar/workshops/${workshopId}/queue/preview`, {
    method: "POST",
    headers: { ...(await sessionAuthHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) return readFailure(response);
  const parsed = readWorkshopQueuePreview(await response.json());
  if (!parsed) {
    return { ok: false, status: response.status, code: null, message: "Сервер вернул предпросмотр в неожиданном виде.", stale: false, diagnostic: null };
  }
  return { ok: true, data: parsed };
}

export async function postWorkshopQueueApply(
  workshopId: number,
  body: { revision: string; ordered_snapshot_node_ids: number[]; preview_fingerprint: string },
): Promise<WorkshopQueueCall<WorkshopQueueSection>> {
  const response = await fetch(`${apiBaseUrl()}/production-calendar/workshops/${workshopId}/queue/apply`, {
    method: "POST",
    headers: { ...(await sessionAuthHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) return readFailure(response);
  const parsed = readAppliedWorkshopQueue(await response.json());
  if (!parsed) {
    return { ok: false, status: response.status, code: null, message: "Сервер сохранил очередь, но ответ не удалось прочитать. Обновите список.", stale: false, diagnostic: null };
  }
  return { ok: true, data: parsed };
}
