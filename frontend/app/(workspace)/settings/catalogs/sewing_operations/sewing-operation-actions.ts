"use server";

import { revalidatePath } from "next/cache";

import {
  parseDurationSecondsInput,
  parseSewingCostInput,
  validateSewingOperationDraft,
  type SewingOperation,
  type SewingOperationCreateDraft,
} from "@/lib/sewing-operations";

export type SewingOperationActionResult =
  | { ok: true; operation: SewingOperation }
  | { ok: false; message: string };

const CATALOG_PATH = "/settings/catalogs/sewing_operations";

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

function normalizeOperation(operation: SewingOperation): SewingOperation {
  return {
    ...operation,
    duration_seconds: Number(operation.duration_seconds ?? 0) || 0,
  };
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

function payloadFromDraft(draft: SewingOperationCreateDraft): {
  name: string;
  cost: string;
  duration_seconds: number;
} | null {
  const cost = parseSewingCostInput(draft.cost);
  const durationSeconds = parseDurationSecondsInput(draft.duration_seconds);
  if (cost == null || durationSeconds == null) {
    return null;
  }
  return {
    name: draft.name.trim(),
    cost,
    duration_seconds: durationSeconds,
  };
}

export async function createSewingOperation(
  draft: SewingOperationCreateDraft,
): Promise<SewingOperationActionResult> {
  const validationError = validateSewingOperationDraft(draft);
  if (validationError) {
    return { ok: false, message: validationError };
  }
  const body = payloadFromDraft(draft);
  if (body == null) {
    return { ok: false, message: "Проверьте стоимость и время выполнения" };
  }

  const response = await fetch(`${apiBaseUrl()}/sewing-operations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const operation = normalizeOperation(
    (await response.json()) as SewingOperation,
  );
  revalidatePath(CATALOG_PATH);
  return { ok: true, operation };
}

export async function updateSewingOperation(
  operationId: number,
  draft: SewingOperationCreateDraft,
): Promise<SewingOperationActionResult> {
  const validationError = validateSewingOperationDraft(draft);
  if (validationError) {
    return { ok: false, message: validationError };
  }
  const body = payloadFromDraft(draft);
  if (body == null) {
    return { ok: false, message: "Проверьте стоимость и время выполнения" };
  }

  const response = await fetch(
    `${apiBaseUrl()}/sewing-operations/${operationId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const operation = normalizeOperation(
    (await response.json()) as SewingOperation,
  );
  revalidatePath(CATALOG_PATH);
  return { ok: true, operation };
}

export async function deleteSewingOperation(
  operationId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(
    `${apiBaseUrl()}/sewing-operations/${operationId}`,
    { method: "DELETE", cache: "no-store" },
  );
  if (!response.ok && response.status !== 204) {
    return { ok: false, message: await readError(response) };
  }
  revalidatePath(CATALOG_PATH);
  return { ok: true };
}
