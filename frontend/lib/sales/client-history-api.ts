import "server-only";

import {
  fromApiClientHistoryItem,
  type ApiClientHistory,
  type ClientHistoryItemView,
} from "@/lib/sales/client-history";

export type ClientHistoryLoadResult =
  | { ok: true; items: ClientHistoryItemView[]; total: number }
  | { ok: false; items: []; total: 0; message: string };

function apiBaseUrl() {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export async function getClientHistory(
  clientId: string,
): Promise<ClientHistoryLoadResult> {
  if (!/^\d+$/.test(clientId)) {
    return { ok: false, items: [], total: 0, message: "Некорректный клиент." };
  }
  try {
    const response = await fetch(
      `${apiBaseUrl()}/clients/${clientId}/history?limit=100`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return {
        ok: false,
        items: [],
        total: 0,
        message: `Не удалось загрузить историю (${response.status}).`,
      };
    }
    const body = (await response.json()) as ApiClientHistory;
    return {
      ok: true,
      items: (body.items ?? []).map(fromApiClientHistoryItem),
      total: body.total,
    };
  } catch {
    return {
      ok: false,
      items: [],
      total: 0,
      message: "Не удалось загрузить историю. Demo-данные не подставлены.",
    };
  }
}
