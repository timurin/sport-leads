import "server-only";

import { fromApiClientListItem, type ApiClientListItem } from "@/lib/sales/client-list-mapping";
import type { Client } from "@/types/sales";

export type ClientListLoadResult =
  | { ok: true; clients: Client[]; source: "api" }
  | { ok: false; clients: []; source: "api"; message: string };

function apiBaseUrl() {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

async function errorMessage(response: Response) {
  try {
    const body = (await response.json()) as { detail?: string | Array<{ msg?: string }> };
    if (typeof body.detail === "string") {
      return body.detail;
    }
    if (Array.isArray(body.detail)) {
      return body.detail.map((item) => item.msg).filter(Boolean).join(" ");
    }
  } catch {
    // Keep the stable status-based message for non-JSON responses.
  }
  return `Backend отклонил загрузку клиентов (${response.status}).`;
}

export async function getClientList(): Promise<ClientListLoadResult> {
  try {
    const response = await fetch(`${apiBaseUrl()}/clients?limit=500`, { cache: "no-store" });
    if (!response.ok) {
      return { ok: false, clients: [], source: "api", message: await errorMessage(response) };
    }
    const body = (await response.json()) as ApiClientListItem[];
    return { ok: true, clients: body.map(fromApiClientListItem), source: "api" };
  } catch {
    return {
      ok: false,
      clients: [],
      source: "api",
      message: "Не удалось загрузить клиентов из backend. Demo-данные не подставлены.",
    };
  }
}
