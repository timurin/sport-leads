"use server";

import { revalidatePath } from "next/cache";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import {
  exceptionWriteBody,
  readCapacityResource,
  resourceWriteBody,
  uniqueResourceKeys,
  validateCapacityException,
  validateCapacityResource,
  type CapacityException,
  type CapacityResource,
} from "@/lib/tech-operation-capacity";

const CATALOG_PATH = "/settings/catalogs/tech-operations";
const CAPACITY_PATH = "/production/calendar/capacity";

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
    if (Array.isArray(body.detail) && body.detail.length > 0) {
      const first = body.detail[0] as { msg?: string };
      if (typeof first?.msg === "string" && first.msg.trim()) return first.msg;
    }
  } catch {
    /* ignore */
  }
  return `Ошибка API (${response.status})`;
}

async function request(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  const session = await sessionAuthHeaders();
  if (session.Cookie) headers.set("Cookie", session.Cookie);
  if (init.body != null && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${apiBaseUrl()}${path}`, { ...init, headers, cache: "no-store" });
}

function refreshCapacity() {
  revalidatePath(CATALOG_PATH);
  revalidatePath(CAPACITY_PATH);
}

export async function loadCapacityResource(
  resourceKey: string,
): Promise<{ ok: true; resource: CapacityResource } | { ok: false; message: string }> {
  const response = await request(`/production-calendar/capacity/resources/${encodeURIComponent(resourceKey)}`, { method: "GET" });
  if (!response.ok) return { ok: false, message: await readError(response) };
  return { ok: true, resource: readCapacityResource(await response.json()) };
}

export async function saveCapacityResource(
  resource: CapacityResource,
): Promise<{ ok: true; resource: CapacityResource } | { ok: false; message: string }> {
  const validationError = validateCapacityResource(resource);
  if (validationError) return { ok: false, message: validationError };
  const response = await request(`/production-calendar/capacity/resources/${encodeURIComponent(resource.key)}`, {
    method: "PUT",
    body: JSON.stringify(resourceWriteBody(resource)),
  });
  if (!response.ok) return { ok: false, message: await readError(response) };
  refreshCapacity();
  return { ok: true, resource: readCapacityResource(await response.json()) };
}

export async function setOperationCapacityResources(
  operationId: number,
  keys: string[],
): Promise<{ ok: true; capacity_resource_keys: string[] } | { ok: false; message: string }> {
  const response = await request(`/tech-operations/${operationId}`, {
    method: "PATCH",
    body: JSON.stringify({ capacity_resource_keys: uniqueResourceKeys(keys) }),
  });
  if (!response.ok) return { ok: false, message: await readError(response) };
  const body = (await response.json()) as { capacity_resource_keys?: string[] };
  refreshCapacity();
  return { ok: true, capacity_resource_keys: body.capacity_resource_keys ?? uniqueResourceKeys(keys) };
}

export async function saveCapacityResourceException(
  resourceKey: string,
  exception: CapacityException,
): Promise<{ ok: true; exception: CapacityException } | { ok: false; message: string }> {
  const validationError = validateCapacityException(exception);
  if (validationError) return { ok: false, message: validationError };
  const response = await request(
    `/production-calendar/capacity/resources/${encodeURIComponent(resourceKey)}/exceptions/${exception.date}`,
    { method: "PUT", body: JSON.stringify(exceptionWriteBody(exception)) },
  );
  if (!response.ok) return { ok: false, message: await readError(response) };
  refreshCapacity();
  const saved = readCapacityResource({ key: resourceKey, exceptions: [await response.json()] }).exceptions[0];
  return { ok: true, exception: saved ?? exception };
}

export async function deleteCapacityResourceException(
  resourceKey: string,
  date: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await request(
    `/production-calendar/capacity/resources/${encodeURIComponent(resourceKey)}/exceptions/${date}`,
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 204) return { ok: false, message: await readError(response) };
  refreshCapacity();
  return { ok: true };
}
