"use server";

import { revalidatePath } from "next/cache";

import {
  validateProductionStageDraft,
  type ProductionStage,
  type ProductionStageDraft,
} from "@/lib/production-stages";

const CATALOG_PATH = "/settings/catalogs/production-stages";

export type ProductionStageActionResult =
  | { ok: true; stage: ProductionStage }
  | { ok: false; message: string };

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string | unknown };
    if (typeof body.detail === "string" && body.detail.trim()) {
      return body.detail;
    }
    if (Array.isArray(body.detail) && body.detail[0]) {
      const first = body.detail[0] as { msg?: string };
      if (typeof first.msg === "string" && first.msg.trim()) return first.msg;
    }
  } catch {
    /* ignore */
  }
  return `Ошибка API (${response.status})`;
}

function payloadFromDraft(
  draft: ProductionStageDraft,
): ProductionStageDraft | null {
  if (validateProductionStageDraft(draft)) return null;
  return {
    name: draft.name.trim(),
    code: draft.code.trim(),
    is_active: draft.is_active,
    sort_order: draft.sort_order,
  };
}

async function saveStage(
  url: string,
  method: "POST" | "PATCH",
  draft: ProductionStageDraft,
): Promise<ProductionStageActionResult> {
  const validationError = validateProductionStageDraft(draft);
  if (validationError) return { ok: false, message: validationError };
  const body = payloadFromDraft(draft);
  if (!body) return { ok: false, message: "Проверьте реквизиты цеха" };
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, message: await readError(response) };
  const stage = (await response.json()) as ProductionStage;
  revalidatePath(CATALOG_PATH);
  return { ok: true, stage };
}

export async function createProductionStage(
  draft: ProductionStageDraft,
): Promise<ProductionStageActionResult> {
  return saveStage(`${apiBaseUrl()}/production-stages`, "POST", draft);
}

export async function updateProductionStage(
  stageId: number,
  draft: ProductionStageDraft,
): Promise<ProductionStageActionResult> {
  return saveStage(`${apiBaseUrl()}/production-stages/${stageId}`, "PATCH", draft);
}

export async function deleteProductionStage(
  stageId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(`${apiBaseUrl()}/production-stages/${stageId}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!response.ok && response.status !== 204) {
    return { ok: false, message: await readError(response) };
  }
  revalidatePath(CATALOG_PATH);
  return { ok: true };
}
