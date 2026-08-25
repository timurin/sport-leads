import "server-only";

import {
  fromApiClientSettlements,
  type ApiClientSettlementsSummary,
  type ClientSettlementsView,
} from "@/lib/sales/client-settlements";

export type ClientSettlementsLoadResult =
  | { ok: true; summary: ClientSettlementsView }
  | { ok: false; summary: null; message: string };

function apiBaseUrl() {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export async function getClientSettlementsSummary(
  clientId: string,
): Promise<ClientSettlementsLoadResult> {
  if (!/^\d+$/.test(clientId)) {
    return { ok: false, summary: null, message: "Некорректный клиент." };
  }
  try {
    const response = await fetch(
      `${apiBaseUrl()}/clients/${clientId}/settlements-summary`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return {
        ok: false,
        summary: null,
        message: `Не удалось загрузить взаиморасчёты (${response.status}).`,
      };
    }
    const body = (await response.json()) as ApiClientSettlementsSummary;
    return { ok: true, summary: fromApiClientSettlements(body) };
  } catch {
    return {
      ok: false,
      summary: null,
      message: "Не удалось загрузить взаиморасчёты. Demo-данные не подставлены.",
    };
  }
}
