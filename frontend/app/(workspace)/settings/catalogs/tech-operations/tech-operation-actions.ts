"use server";

import { revalidatePath } from "next/cache";

import {
  validateTechOperationDraft,
  type TechOperation,
  type TechOperationDraft,
} from "@/lib/tech-operations";

export type TechOperationActionResult =
  | { ok: true; operation: TechOperation }
  | { ok: false; message: string };

const CATALOG_PATH = "/settings/catalogs/tech-operations";

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
    if (Array.isArray(body.detail) && body.detail.length > 0) {
      const first = body.detail[0] as { msg?: string };
      if (typeof first?.msg === "string" && first.msg.trim()) {
        return first.msg;
      }
    }
  } catch {
    /* ignore */
  }
  return `Ошибка API (${response.status})`;
}

function payloadFromDraft(draft: TechOperationDraft): TechOperationDraft | null {
  const validationError = validateTechOperationDraft(draft);
  if (validationError) return null;
  return {
    name: draft.name.trim(),
    code: draft.code.trim(),
    volume_unit: draft.volume_unit,
    production_stage_id: draft.production_stage_id,
    is_active: draft.is_active,
  };
}

export async function createTechOperation(
  draft: TechOperationDraft,
): Promise<TechOperationActionResult> {
  const validationError = validateTechOperationDraft(draft);
  if (validationError) {
    return { ok: false, message: validationError };
  }
  const body = payloadFromDraft(draft);
  if (body == null) {
    return { ok: false, message: "Проверьте реквизиты операции" };
  }

  const response = await fetch(`${apiBaseUrl()}/tech-operations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const operation = (await response.json()) as TechOperation;
  revalidatePath(CATALOG_PATH);
  return { ok: true, operation };
}

export async function updateTechOperation(
  operationId: number,
  draft: TechOperationDraft,
): Promise<TechOperationActionResult> {
  const validationError = validateTechOperationDraft(draft);
  if (validationError) {
    return { ok: false, message: validationError };
  }
  const body = payloadFromDraft(draft);
  if (body == null) {
    return { ok: false, message: "Проверьте реквизиты операции" };
  }

  const response = await fetch(`${apiBaseUrl()}/tech-operations/${operationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const operation = (await response.json()) as TechOperation;
  revalidatePath(CATALOG_PATH);
  return { ok: true, operation };
}

export async function deleteTechOperation(
  operationId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(`${apiBaseUrl()}/tech-operations/${operationId}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!response.ok && response.status !== 204) {
    return { ok: false, message: await readError(response) };
  }
  revalidatePath(CATALOG_PATH);
  return { ok: true };
}
