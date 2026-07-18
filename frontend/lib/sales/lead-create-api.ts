import "server-only";

import type { ApiLeadListItem } from "@/lib/sales/lead-list-mapping";
import type { LeadCreatePayload } from "@/lib/sales/lead-creation";

export type LeadCreateApiResult =
  | { ok: true; lead: ApiLeadListItem }
  | { ok: false; message: string };

function apiBaseUrl() {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

async function errorMessage(response: Response) {
  try {
    const body = await response.json() as { detail?: string | Array<{ msg?: string }> };
    if (typeof body.detail === "string") {
      return body.detail;
    }
    if (Array.isArray(body.detail)) {
      return body.detail.map((item) => item.msg).filter(Boolean).join(" ");
    }
  } catch {
    // Keep the stable status-based message for non-JSON responses.
  }
  return `Backend отклонил создание лида (${response.status}).`;
}

export async function createApiLead(payload: LeadCreatePayload): Promise<LeadCreateApiResult> {
  try {
    const response = await fetch(`${apiBaseUrl()}/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, message: await errorMessage(response) };
    }
    return { ok: true, lead: await response.json() as ApiLeadListItem };
  } catch {
    return { ok: false, message: "Не удалось связаться с backend. Лид не создан." };
  }
}
