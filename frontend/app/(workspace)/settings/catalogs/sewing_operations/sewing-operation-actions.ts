"use server";

import {
  parseSewingCostInput,
  validateSewingOperationDraft,
  type SewingOperation,
  type SewingOperationCreateDraft,
} from "@/lib/sewing-operations";

export type SewingOperationActionResult =
  | { ok: true; operation: SewingOperation }
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
  } catch {
    /* ignore */
  }
  return `Ошибка API (${response.status})`;
}

export async function createSewingOperation(
  draft: SewingOperationCreateDraft,
): Promise<SewingOperationActionResult> {
  const validationError = validateSewingOperationDraft(draft);
  if (validationError) {
    return { ok: false, message: validationError };
  }
  const cost = parseSewingCostInput(draft.cost);
  if (cost == null) {
    return { ok: false, message: "Укажите стоимость (число ≥ 0)" };
  }

  const response = await fetch(`${apiBaseUrl()}/sewing-operations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: draft.name.trim(), cost }),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  return {
    ok: true,
    operation: (await response.json()) as SewingOperation,
  };
}

export async function updateSewingOperation(
  operationId: number,
  draft: SewingOperationCreateDraft,
): Promise<SewingOperationActionResult> {
  const validationError = validateSewingOperationDraft(draft);
  if (validationError) {
    return { ok: false, message: validationError };
  }
  const cost = parseSewingCostInput(draft.cost);
  if (cost == null) {
    return { ok: false, message: "Укажите стоимость (число ≥ 0)" };
  }

  const response = await fetch(
    `${apiBaseUrl()}/sewing-operations/${operationId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draft.name.trim(), cost }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  return {
    ok: true,
    operation: (await response.json()) as SewingOperation,
  };
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
  return { ok: true };
}
