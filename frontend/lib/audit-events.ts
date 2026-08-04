/**
 * Platform audit events client (ADR-025 / 17.1.3.3).
 */

import "server-only";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import type { AuditEvent } from "@/lib/audit-events-mapping";

export type { AuditEvent } from "@/lib/audit-events-mapping";
export {
  auditEventsSummary,
  formatAuditAction,
  formatAuditActor,
} from "@/lib/audit-events-mapping";

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export async function getSizeGridAuditEvents(
  sizeGridId: number,
  options?: { limit?: number },
): Promise<AuditEvent[]> {
  const limit = options?.limit ?? 30;
  const query = new URLSearchParams({
    size_grid_id: String(sizeGridId),
    limit: String(limit),
  });
  const headers = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/audit-events?${query}`, {
    cache: "no-store",
    headers,
  });
  if (response.status === 401 || response.status === 403) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`Не удалось загрузить журнал аудита (${response.status})`);
  }
  const body = (await response.json()) as { items: AuditEvent[] };
  return body.items ?? [];
}
