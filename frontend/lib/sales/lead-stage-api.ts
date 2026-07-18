import "server-only";

import {
  fromApiLeadStage,
  toApiLeadStageConfiguration,
  type ApiLeadStage,
} from "@/lib/sales/lead-stage-api-mapping";
import type { LeadStageConfig } from "@/lib/sales/lead-stages";

export type LeadStageLoadResult =
  | { ok: true; stages: LeadStageConfig[] }
  | { ok: false; stages: []; message: string };

export type LeadStageSaveResult =
  | { ok: true; stages: LeadStageConfig[] }
  | { ok: false; message: string };

function apiBaseUrl() {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

async function responseError(response: Response, fallback: string) {
  try {
    const body = await response.json() as { detail?: string | Array<{ msg?: string }> };
    if (typeof body.detail === "string") {
      return body.detail;
    }
    if (Array.isArray(body.detail)) {
      return body.detail.map((item) => item.msg).filter(Boolean).join(" ") || fallback;
    }
  } catch {
    // Keep the stable fallback for an empty or non-JSON response.
  }
  return fallback;
}

export async function getLeadStages(): Promise<LeadStageLoadResult> {
  try {
    const response = await fetch(`${apiBaseUrl()}/lead-stages`, { cache: "no-store" });
    if (!response.ok) {
      return {
        ok: false,
        stages: [],
        message: await responseError(response, `Backend отклонил загрузку стадий (${response.status}).`),
      };
    }
    const body = await response.json() as ApiLeadStage[];
    return { ok: true, stages: body.map(fromApiLeadStage) };
  } catch {
    return { ok: false, stages: [], message: "Не удалось загрузить стадии лидов из backend." };
  }
}

export async function saveLeadStages(
  stages: readonly LeadStageConfig[],
  transfers: Readonly<Record<string, string>>,
): Promise<LeadStageSaveResult> {
  try {
    const response = await fetch(`${apiBaseUrl()}/lead-stages`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toApiLeadStageConfiguration(stages, transfers)),
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        ok: false,
        message: await responseError(response, `Backend отклонил настройку стадий (${response.status}).`),
      };
    }
    const body = await response.json() as ApiLeadStage[];
    return { ok: true, stages: body.map(fromApiLeadStage) };
  } catch {
    return { ok: false, message: "Не удалось связаться с backend. Настройки не сохранены." };
  }
}
