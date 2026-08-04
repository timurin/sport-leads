"use server";

import { revalidatePath } from "next/cache";

import {
  nextSewingOperationCopyName,
  parseDurationSecondsInput,
  parseQuantityPerItemInput,
  parseSewingCostInput,
  toSewingCostInput,
  validateSewingOperationDraft,
  type SewingOperation,
  type SewingOperationCreateDraft,
  type SewingOperationFolder,
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

function normalizeWorkCenterIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const ids: number[] = [];
  for (const item of value) {
    const id = Number(item);
    if (Number.isSafeInteger(id) && id > 0 && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

function normalizeOperation(operation: SewingOperation): SewingOperation {
  return {
    ...operation,
    quantity_per_item: Math.max(1, Number(operation.quantity_per_item ?? 1) || 1),
    duration_seconds: Number(operation.duration_seconds ?? 0) || 0,
    folder_id:
      operation.folder_id == null || Number(operation.folder_id) <= 0
        ? null
        : Number(operation.folder_id),
    sort_order: Number(operation.sort_order ?? 0) || 0,
    work_center_ids: normalizeWorkCenterIds(operation.work_center_ids),
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
  quantity_per_item: number;
  duration_seconds: number;
  folder_id: number | null;
  work_center_ids: number[];
} | null {
  const cost = parseSewingCostInput(draft.cost);
  const quantityPerItem = parseQuantityPerItemInput(draft.quantity_per_item);
  const durationSeconds = parseDurationSecondsInput(draft.duration_seconds);
  if (cost == null || quantityPerItem == null || durationSeconds == null) {
    return null;
  }
  return {
    name: draft.name.trim(),
    cost,
    quantity_per_item: quantityPerItem,
    duration_seconds: durationSeconds,
    folder_id: draft.folder_id,
    work_center_ids: normalizeWorkCenterIds(draft.work_center_ids),
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
    return {
      ok: false,
      message: "Проверьте стоимость, количество и время выполнения",
    };
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

export async function copySewingOperation(
  operationId: number,
  existingNames: string[],
): Promise<SewingOperationActionResult> {
  if (!Number.isSafeInteger(operationId) || operationId <= 0) {
    return { ok: false, message: "Некорректная операция" };
  }
  const response = await fetch(
    `${apiBaseUrl()}/sewing-operations/${operationId}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const source = normalizeOperation(
    (await response.json()) as SewingOperation,
  );
  const draft: SewingOperationCreateDraft = {
    name: nextSewingOperationCopyName(source.name, existingNames),
    cost: toSewingCostInput(source.cost),
    quantity_per_item: String(source.quantity_per_item ?? 1),
    duration_seconds: String(source.duration_seconds ?? 0),
    folder_id: source.folder_id,
    work_center_ids: [...(source.work_center_ids ?? [])],
  };
  return createSewingOperation(draft);
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
    return {
      ok: false,
      message: "Проверьте стоимость, количество и время выполнения",
    };
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

export async function moveSewingOperationsToFolder(
  operationIds: number[],
  folderId: number | null,
): Promise<
  | { ok: true; operations: SewingOperation[] }
  | { ok: false; message: string }
> {
  const uniqueIds = [...new Set(operationIds)].filter(
    (id) => Number.isSafeInteger(id) && id > 0,
  );
  if (uniqueIds.length === 0) {
    return { ok: false, message: "Выберите хотя бы одну операцию" };
  }
  const operations: SewingOperation[] = [];
  for (const operationId of uniqueIds) {
    const response = await fetch(
      `${apiBaseUrl()}/sewing-operations/${operationId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: folderId }),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      return { ok: false, message: await readError(response) };
    }
    operations.push(
      normalizeOperation((await response.json()) as SewingOperation),
    );
  }
  revalidatePath(CATALOG_PATH);
  return { ok: true, operations };
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

export type SewingFolderActionResult =
  | { ok: true; folder: SewingOperationFolder }
  | { ok: false; message: string };

export async function createSewingOperationFolder(input: {
  name: string;
  parent_id: number | null;
}): Promise<SewingFolderActionResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Укажите название папки" };
  const response = await fetch(`${apiBaseUrl()}/sewing-operation-folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, parent_id: input.parent_id }),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const folder = (await response.json()) as SewingOperationFolder;
  revalidatePath(CATALOG_PATH);
  return { ok: true, folder };
}

export async function updateSewingOperationFolder(
  folderId: number,
  input: { name?: string; parent_id?: number | null },
): Promise<SewingFolderActionResult> {
  const body: Record<string, unknown> = {};
  if (input.name != null) body.name = input.name.trim();
  if ("parent_id" in input) body.parent_id = input.parent_id ?? null;
  const response = await fetch(
    `${apiBaseUrl()}/sewing-operation-folders/${folderId}`,
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
  const folder = (await response.json()) as SewingOperationFolder;
  revalidatePath(CATALOG_PATH);
  return { ok: true, folder };
}

export async function deleteSewingOperationFolder(
  folderId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(
    `${apiBaseUrl()}/sewing-operation-folders/${folderId}`,
    { method: "DELETE", cache: "no-store" },
  );
  if (!response.ok && response.status !== 204) {
    return { ok: false, message: await readError(response) };
  }
  revalidatePath(CATALOG_PATH);
  return { ok: true };
}

export async function moveSewingOperationFolderSibling(
  folderId: number,
  direction: "up" | "down",
): Promise<SewingFolderActionResult> {
  const response = await fetch(
    `${apiBaseUrl()}/sewing-operation-folders/${folderId}/move-sibling`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const folder = (await response.json()) as SewingOperationFolder;
  revalidatePath(CATALOG_PATH);
  return { ok: true, folder };
}

export async function moveSewingOperationSibling(
  operationId: number,
  direction: "up" | "down",
): Promise<SewingOperationActionResult> {
  const response = await fetch(
    `${apiBaseUrl()}/sewing-operations/${operationId}/move-sibling`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
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
