import "server-only";

import {
  fromApiClientDetail,
  type ApiClientDetail,
  type ClientCardView,
} from "@/lib/sales/client-card-mapping";

export type ClientDetailLoadResult =
  | { ok: true; client: ClientCardView; source: "api" }
  | { ok: false; client: null; source: "api"; message: string; notFound?: boolean };

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
  return `Backend отклонил загрузку клиента (${response.status}).`;
}

export async function getClientDetail(clientId: string): Promise<ClientDetailLoadResult> {
  if (!/^\d+$/.test(clientId)) {
    return {
      ok: false,
      client: null,
      source: "api",
      message: "Некорректный идентификатор клиента.",
      notFound: true,
    };
  }
  try {
    const response = await fetch(`${apiBaseUrl()}/clients/${clientId}`, { cache: "no-store" });
    if (response.status === 404) {
      return {
        ok: false,
        client: null,
        source: "api",
        message: "Клиент не найден.",
        notFound: true,
      };
    }
    if (!response.ok) {
      return { ok: false, client: null, source: "api", message: await errorMessage(response) };
    }
    const body = (await response.json()) as ApiClientDetail;
    return { ok: true, client: fromApiClientDetail(body), source: "api" };
  } catch {
    return {
      ok: false,
      client: null,
      source: "api",
      message: "Не удалось загрузить клиента из backend. Demo-данные не подставлены.",
    };
  }
}
