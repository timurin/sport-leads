"use server";

import { revalidatePath } from "next/cache";

import {
  validateWarehouseDraft,
  type Warehouse,
  type WarehouseDraft,
} from "@/lib/warehouses";

export type WarehouseActionResult =
  | { ok: true; warehouse: Warehouse }
  | { ok: false; message: string };

const CATALOG_PATH = "/settings/catalogs/warehouses";

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

function payloadFromDraft(draft: WarehouseDraft) {
  return {
    name: draft.name.trim(),
    code: draft.code.trim(),
    is_active: draft.is_active,
    is_default: draft.is_default,
  };
}

function revalidate() {
  revalidatePath(CATALOG_PATH);
}

export async function createWarehouse(
  draft: WarehouseDraft,
): Promise<WarehouseActionResult> {
  const validationError = validateWarehouseDraft(draft);
  if (validationError) {
    return { ok: false, message: validationError };
  }

  const response = await fetch(`${apiBaseUrl()}/warehouses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloadFromDraft(draft)),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const warehouse = (await response.json()) as Warehouse;
  revalidate();
  return { ok: true, warehouse };
}

export async function updateWarehouse(
  warehouseId: number,
  draft: WarehouseDraft,
): Promise<WarehouseActionResult> {
  const validationError = validateWarehouseDraft(draft);
  if (validationError) {
    return { ok: false, message: validationError };
  }

  const response = await fetch(`${apiBaseUrl()}/warehouses/${warehouseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloadFromDraft(draft)),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const warehouse = (await response.json()) as Warehouse;
  revalidate();
  return { ok: true, warehouse };
}

export async function deleteWarehouse(
  warehouseId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(`${apiBaseUrl()}/warehouses/${warehouseId}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!response.ok && response.status !== 204) {
    return { ok: false, message: await readError(response) };
  }
  revalidate();
  return { ok: true };
}
