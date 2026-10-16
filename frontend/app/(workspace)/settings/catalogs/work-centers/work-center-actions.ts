"use server";

import { revalidatePath } from "next/cache";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import {
  exceptionWriteBody,
  readCapacityResource,
  validateCapacityException,
  validateCapacityResource,
  type CapacityException,
  type CapacityResource,
} from "@/lib/tech-operation-capacity";
import {
  validateWorkCenterDraft,
  type WorkCenter,
  type WorkCenterDraft,
} from "@/lib/shop-routings";

export type WorkCenterActionResult =
  | { ok: true; workCenter: WorkCenter }
  | { ok: false; message: string };

const CATALOG_PATH = "/settings/catalogs/work-centers";
const ROUTINGS_PATH = "/settings/catalogs/routings";
const OPERATIONS_PATH = "/settings/catalogs/tech-operations";
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

function payloadFromDraft(draft: WorkCenterDraft) {
  return {
    name: draft.name.trim(),
    code: draft.code.trim(),
    production_stage_id: draft.production_stage_id,
    is_active: draft.is_active,
  };
}

function revalidate() {
  revalidatePath(CATALOG_PATH);
  revalidatePath(ROUTINGS_PATH);
}

function revalidateCapacity() {
  revalidate();
  revalidatePath(OPERATIONS_PATH);
  revalidatePath(CAPACITY_PATH);
}

function blankToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

async function authorizedFetch(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  const session = await sessionAuthHeaders();
  if (session.Cookie) headers.set("Cookie", session.Cookie);
  if (init.body != null && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${apiBaseUrl()}${path}`, { ...init, headers, cache: "no-store" });
}

export async function loadWorkCenterCapacity(
  workCenterId: number,
): Promise<{ ok: true; resource: CapacityResource } | { ok: false; missing: boolean; message: string }> {
  const response = await authorizedFetch(`/work-centers/${workCenterId}/capacity`, { method: "GET" });
  if (response.status === 404) return { ok: false, missing: true, message: "Мощность ещё не задана" };
  if (!response.ok) return { ok: false, missing: false, message: await readError(response) };
  return { ok: true, resource: readCapacityResource(await response.json()) };
}

export async function saveWorkCenterCapacity(
  workCenterId: number,
  resource: CapacityResource,
): Promise<{ ok: true; resource: CapacityResource } | { ok: false; message: string }> {
  const validationError = validateCapacityResource({ ...resource, resource_type: "machine", work_center_id: workCenterId });
  if (validationError) return { ok: false, message: validationError };
  const unit = resource.capacity_unit;
  const response = await authorizedFetch(`/work-centers/${workCenterId}/capacity`, {
    method: "PUT",
    body: JSON.stringify({
      capacity_unit: unit,
      base_rate: unit === "machine_hour" ? null : blankToNull(resource.base_rate),
      hours_per_day: blankToNull(resource.hours_per_day),
      shifts_per_day: resource.shifts_per_day,
      efficiency: blankToNull(resource.efficiency) ?? "1",
      working_days: [...resource.working_days].sort((a, b) => a - b),
      include_in_calendar_load: resource.include_in_calendar_load,
      note: blankToNull(resource.note),
    }),
  });
  if (!response.ok) return { ok: false, message: await readError(response) };
  revalidateCapacity();
  return { ok: true, resource: readCapacityResource(await response.json()) };
}

export async function saveWorkCenterCapacityException(
  workCenterId: number,
  exception: CapacityException,
): Promise<{ ok: true; exception: CapacityException } | { ok: false; message: string }> {
  const validationError = validateCapacityException(exception);
  if (validationError) return { ok: false, message: validationError };
  const response = await authorizedFetch(
    `/work-centers/${workCenterId}/capacity/exceptions/${exception.date}`,
    { method: "PUT", body: JSON.stringify(exceptionWriteBody(exception)) },
  );
  if (!response.ok) return { ok: false, message: await readError(response) };
  revalidateCapacity();
  const saved = readCapacityResource({ key: "work_center", exceptions: [await response.json()] }).exceptions[0];
  return { ok: true, exception: saved ?? exception };
}

export async function deleteWorkCenterCapacityException(
  workCenterId: number,
  date: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const loaded = await loadWorkCenterCapacity(workCenterId);
  if (!loaded.ok) return { ok: false, message: loaded.message };
  const response = await authorizedFetch(
    `/production-calendar/capacity/resources/${encodeURIComponent(loaded.resource.key)}/exceptions/${date}`,
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 204) return { ok: false, message: await readError(response) };
  revalidateCapacity();
  return { ok: true };
}

export async function createWorkCenter(
  draft: WorkCenterDraft,
): Promise<WorkCenterActionResult> {
  const validationError = validateWorkCenterDraft(draft);
  if (validationError) {
    return { ok: false, message: validationError };
  }

  const response = await fetch(`${apiBaseUrl()}/work-centers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloadFromDraft(draft)),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const workCenter = (await response.json()) as WorkCenter;
  revalidate();
  return { ok: true, workCenter };
}

export async function updateWorkCenter(
  workCenterId: number,
  draft: WorkCenterDraft,
): Promise<WorkCenterActionResult> {
  const validationError = validateWorkCenterDraft(draft);
  if (validationError) {
    return { ok: false, message: validationError };
  }

  const response = await fetch(`${apiBaseUrl()}/work-centers/${workCenterId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloadFromDraft(draft)),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const workCenter = (await response.json()) as WorkCenter;
  revalidate();
  return { ok: true, workCenter };
}

export async function deleteWorkCenter(
  workCenterId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(`${apiBaseUrl()}/work-centers/${workCenterId}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!response.ok && response.status !== 204) {
    return { ok: false, message: await readError(response) };
  }
  revalidate();
  return { ok: true };
}
