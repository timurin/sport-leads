import "server-only";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import type {
  SewingCabinet,
  SewingPeriodPreset,
  SewingSewerListItem,
  SewingWorkEntry,
} from "@/lib/production/sewing-cabinet";

function apiBaseUrl() {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

function periodQuery(
  period: SewingPeriodPreset,
  dateFrom?: string,
  dateTo?: string,
): string {
  const params = new URLSearchParams({ period });
  if (period === "custom" && dateFrom && dateTo) {
    params.set("date_from", dateFrom);
    params.set("date_to", dateTo);
  }
  return params.toString();
}

async function parseError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
  } catch {
    // keep fallback
  }
  return `${fallback} (${response.status}).`;
}

export type SewingCabinetLoadResult =
  | { ok: true; cabinet: SewingCabinet }
  | { ok: false; cabinet: null; message: string; forbidden?: boolean };

export async function getSewingCabinet(input?: {
  platformUserId?: number;
  period?: SewingPeriodPreset;
  dateFrom?: string;
  dateTo?: string;
}): Promise<SewingCabinetLoadResult> {
  const period = input?.period ?? "day";
  const query = periodQuery(period, input?.dateFrom, input?.dateTo);
  const path =
    input?.platformUserId != null
      ? `/sewing-cabinet/users/${input.platformUserId}?${query}`
      : `/sewing-cabinet?${query}`;
  try {
    const auth = await sessionAuthHeaders();
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      headers: { ...auth },
      cache: "no-store",
    });
    if (response.status === 403) {
      return {
        ok: false,
        cabinet: null,
        message: await parseError(response, "Нет доступа к кабинету"),
        forbidden: true,
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        cabinet: null,
        message: await parseError(response, "Не удалось загрузить кабинет швеи"),
      };
    }
    const cabinet = (await response.json()) as SewingCabinet;
    return { ok: true, cabinet };
  } catch {
    return {
      ok: false,
      cabinet: null,
      message: "Не удалось загрузить кабинет швеи. Demo-данные не подставлены.",
    };
  }
}

export type SewingSewersLoadResult =
  | { ok: true; items: SewingSewerListItem[] }
  | { ok: false; items: []; message: string };

export async function getSewingSewers(input?: {
  period?: SewingPeriodPreset;
  dateFrom?: string;
  dateTo?: string;
}): Promise<SewingSewersLoadResult> {
  const period = input?.period ?? "day";
  const query = periodQuery(period, input?.dateFrom, input?.dateTo);
  try {
    const auth = await sessionAuthHeaders();
    const response = await fetch(`${apiBaseUrl()}/sewing-cabinet/sewers?${query}`, {
      headers: { ...auth },
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        ok: false,
        items: [],
        message: await parseError(response, "Не удалось загрузить список швей"),
      };
    }
    const items = (await response.json()) as SewingSewerListItem[];
    return { ok: true, items };
  } catch {
    return {
      ok: false,
      items: [],
      message: "Не удалось загрузить список швей. Demo-данные не подставлены.",
    };
  }
}

export async function postSewingTake(input: {
  technical_card_id: number;
  kind: "piece" | "operation";
  qty: string;
  operation_line_id?: number;
}): Promise<{ ok: true; entry: SewingWorkEntry } | { ok: false; message: string }> {
  try {
    const auth = await sessionAuthHeaders();
    const response = await fetch(`${apiBaseUrl()}/sewing-cabinet/take`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify(input),
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        ok: false,
        message: await parseError(response, "Не удалось взять работу"),
      };
    }
    return { ok: true, entry: (await response.json()) as SewingWorkEntry };
  } catch {
    return { ok: false, message: "Не удалось взять работу." };
  }
}

export async function postSewingEntryAction(
  entryId: number,
  action: "complete" | "release",
): Promise<{ ok: true; entry: SewingWorkEntry } | { ok: false; message: string }> {
  const label = action === "complete" ? "закрыть" : "отказаться";
  try {
    const auth = await sessionAuthHeaders();
    const response = await fetch(
      `${apiBaseUrl()}/sewing-cabinet/entries/${entryId}/${action}`,
      {
        method: "POST",
        headers: { ...auth },
        cache: "no-store",
      },
    );
    if (!response.ok) {
      return {
        ok: false,
        message: await parseError(response, `Не удалось ${label}`),
      };
    }
    return { ok: true, entry: (await response.json()) as SewingWorkEntry };
  } catch {
    return { ok: false, message: `Не удалось ${label}.` };
  }
}
