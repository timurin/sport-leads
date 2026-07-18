import "server-only";

import { fromApiLeadListItem, type ApiLeadListItem } from "@/lib/sales/lead-list-mapping";
import type { Lead } from "@/types/sales";

export type LeadListLoadResult =
  | { ok: true; leads: Lead[]; source: "api" }
  | { ok: false; leads: []; source: "api"; message: string };

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
  return `Backend отклонил загрузку лидов (${response.status}).`;
}

export async function getLeadList(): Promise<LeadListLoadResult> {
  try {
    const response = await fetch(`${apiBaseUrl()}/leads?limit=500`, { cache: "no-store" });
    if (!response.ok) {
      return { ok: false, leads: [], source: "api", message: await errorMessage(response) };
    }
    const body = await response.json() as ApiLeadListItem[];
    return { ok: true, leads: body.map(fromApiLeadListItem), source: "api" };
  } catch {
    return {
      ok: false,
      leads: [],
      source: "api",
      message: "Не удалось загрузить лиды из backend. Demo-данные не подставлены.",
    };
  }
}
