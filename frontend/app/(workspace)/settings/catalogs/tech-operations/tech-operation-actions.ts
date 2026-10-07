"use server";

import { revalidatePath } from "next/cache";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import { uniqueResourceKeys } from "@/lib/tech-operation-capacity";
import {
  validateTechOperationDraft,
  type TechOperation,
  type TechOperationDraft,
} from "@/lib/tech-operations";

export type TechOperationActionResult =
  | { ok: true; operation: TechOperation }
  | { ok: false; message: string };

const CATALOG_PATH = "/settings/catalogs/tech-operations";
const CAPACITY_PATH = "/production/calendar/capacity";

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

function payloadFromDraft(draft: TechOperationDraft): Record<string, unknown> | null {
  if (validateTechOperationDraft(draft)) return null;
  const body: Record<string, unknown> = {
    name: draft.name.trim(),
    code: draft.code.trim(),
    volume_unit: draft.volume_unit,
    production_stage_id: draft.production_stage_id,
    is_active: draft.is_active,
    required_materials: draft.required_materials.map((row) => ({
      nomenclature_id: row.nomenclature_id,
      quantity:
        typeof row.quantity === "string" ? row.quantity.trim() || "0" : row.quantity,
    })),
  };
  if (Object.prototype.hasOwnProperty.call(draft, "capacity_resource_keys")) {
    body.capacity_resource_keys = uniqueResourceKeys(draft.capacity_resource_keys ?? []);
  }
  return body;
}

function readOperation(body: unknown): TechOperation {
  const operation = body as TechOperation;
  return {
    ...operation,
    capacity_resource_keys: Array.isArray(operation.capacity_resource_keys) ? operation.capacity_resource_keys : [],
  };
}

async function request(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  const session = await sessionAuthHeaders();
  if (session.Cookie) headers.set("Cookie", session.Cookie);
  if (init.body != null && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${apiBaseUrl()}${path}`, { ...init, headers, cache: "no-store" });
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

  const response = await request("/tech-operations", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const operation = readOperation(await response.json());
  revalidatePath(CATALOG_PATH);
  revalidatePath(CAPACITY_PATH);
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

  const response = await request(`/tech-operations/${operationId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const operation = readOperation(await response.json());
  revalidatePath(CATALOG_PATH);
  revalidatePath(CAPACITY_PATH);
  return { ok: true, operation };
}

export async function deleteTechOperation(
  operationId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await request(`/tech-operations/${operationId}`, { method: "DELETE" });
  if (!response.ok && response.status !== 204) {
    return { ok: false, message: await readError(response) };
  }
  revalidatePath(CATALOG_PATH);
  revalidatePath(CAPACITY_PATH);
  return { ok: true };
}
