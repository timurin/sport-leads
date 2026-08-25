import "server-only";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import type {
  TechCardScan,
  TechCardScanCommand,
} from "@/lib/production/tech-card-scan";

function apiBaseUrl() {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
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

export type TechCardScanLoadResult =
  | { ok: true; scan: TechCardScan }
  | { ok: false; scan: null; message: string; unauthorized?: boolean; forbidden?: boolean };

export async function getTechCardScan(
  token: string,
): Promise<TechCardScanLoadResult> {
  const response = await fetch(
    `${apiBaseUrl()}/tech-card-scan/${encodeURIComponent(token)}`,
    { headers: await sessionAuthHeaders(), cache: "no-store" },
  );
  if (response.status === 401) {
    return {
      ok: false,
      scan: null,
      message: "Нужен вход в свою учётную запись",
      unauthorized: true,
    };
  }
  if (response.status === 403) {
    return {
      ok: false,
      scan: null,
      message: await parseError(response, "Нет доступа к скану"),
      forbidden: true,
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      scan: null,
      message: await parseError(response, "Не удалось открыть скан техкарты"),
    };
  }
  return { ok: true, scan: (await response.json()) as TechCardScan };
}

export async function postTechCardScanCommand(
  token: string,
  action: "accept" | "complete-transfer" | "return",
  payload: TechCardScanCommand,
): Promise<TechCardScanLoadResult> {
  const response = await fetch(
    `${apiBaseUrl()}/tech-card-scan/${encodeURIComponent(token)}/${action}`,
    {
      method: "POST",
      headers: {
        ...(await sessionAuthHeaders()),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return {
      ok: false,
      scan: null,
      message: await parseError(response, "Не удалось выполнить команду скана"),
      forbidden: response.status === 403,
    };
  }
  return { ok: true, scan: (await response.json()) as TechCardScan };
}
