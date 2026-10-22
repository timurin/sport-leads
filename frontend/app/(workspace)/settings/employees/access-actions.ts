"use server";

import { revalidatePath } from "next/cache";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import {
  interpretAccessFailure,
  type AccessPreview,
} from "@/lib/settings/access-group-commands";

export type AccessPermission = { code: string; description: string | null };
export type AccessRole = {
  id: number;
  code: string;
  name: string;
  is_system: boolean;
  permissions: string[];
  version: number;
  member_count: number;
};
export type EffectiveAccess = {
  platform_user_id: number;
  role_codes: string[];
  permissions: string[];
  restricted: boolean;
  revision: string;
};

export type AccessRead<T> =
  | { ok: true; data: T }
  | { ok: false; status: number | null; message: string; conflict: boolean };

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

async function readDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
  } catch {
    /* ignore */
  }
  if (response.status === 401) return "Требуется вход.";
  if (response.status === 403) return "Недостаточно прав admin.roles.assign.";
  if (response.status === 404) return "Группа или учётная запись не найдены.";
  return `Ошибка API (${response.status}). Доступ не изменён.`;
}

function refreshAccess(employeeId?: number): void {
  revalidatePath("/settings/employees");
  revalidatePath("/settings/users");
  if (employeeId != null) revalidatePath(`/settings/employees/${employeeId}`);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<AccessRead<T>> {
  try {
    const auth = await sessionAuthHeaders();
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...auth, ...init?.headers },
      cache: "no-store",
    });
    if (!response.ok) {
      const message = await readDetail(response);
      const failure = interpretAccessFailure(response.status, message);
      return { ok: false, status: response.status, message: failure.message, conflict: failure.conflict };
    }
    if (response.status === 204) return { ok: true, data: undefined as T };
    return { ok: true, data: (await response.json()) as T };
  } catch {
    const failure = interpretAccessFailure(null, "Нет связи с сервером. Доступ не изменён.");
    return { ok: false, status: null, message: failure.message, conflict: false };
  }
}

export async function loadAccessCatalog(): Promise<
  AccessRead<{ permissions: AccessPermission[]; roles: AccessRole[] }>
> {
  const [permissions, roles] = await Promise.all([
    requestJson<AccessPermission[]>("/permissions"),
    requestJson<{ items: AccessRole[] }>("/roles"),
  ]);
  if (!permissions.ok) return permissions;
  if (!roles.ok) return roles;
  return { ok: true, data: { permissions: permissions.data, roles: roles.data.items } };
}

export async function loadRole(code: string): Promise<AccessRead<AccessRole>> {
  return requestJson<AccessRole>(`/roles/${encodeURIComponent(code)}`);
}

export async function loadEffectiveAccess(
  platformUserId: number,
): Promise<AccessRead<EffectiveAccess>> {
  return requestJson<EffectiveAccess>(`/platform-users/${platformUserId}/effective-permissions`);
}

export async function loadEmployeeLink(platformUserId: number): Promise<
  AccessRead<{ platform_user_id: number; employee_id: number | null }>
> {
  return requestJson(`/platform-users/${platformUserId}/employee-link`);
}

export async function previewMembership(
  platformUserId: number,
  body: { role_codes: string[]; reason: string },
): Promise<AccessRead<AccessPreview>> {
  return requestJson(`/platform-users/${platformUserId}/roles/preview`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function applyMembership(
  platformUserId: number,
  employeeId: number | null,
  body: { role_codes: string[]; reason: string; revision: string; preview_fingerprint: string },
): Promise<AccessRead<EffectiveAccess>> {
  const result = await requestJson<EffectiveAccess>(`/platform-users/${platformUserId}/roles`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (result.ok) refreshAccess(employeeId ?? undefined);
  return result;
}

export async function previewGroup(
  code: string,
  body: { version: number; name: string; permissions: string[]; reason: string },
): Promise<AccessRead<AccessPreview>> {
  return requestJson(`/roles/${encodeURIComponent(code)}/preview`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function applyGroup(
  code: string,
  body: { version: number; name: string; permissions: string[]; reason: string; revision: string; preview_fingerprint: string },
): Promise<AccessRead<AccessRole>> {
  const result = await requestJson<AccessRole>(`/roles/${encodeURIComponent(code)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (result.ok) refreshAccess();
  return result;
}

export async function createAccessGroup(body: {
  code: string;
  name: string;
  permissions: string[];
  reason: string;
}): Promise<AccessRead<AccessRole>> {
  const result = await requestJson<AccessRole>("/roles", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (result.ok) refreshAccess();
  return result;
}

export async function deleteAccessGroup(
  code: string,
  body: { version: number; reason: string },
): Promise<AccessRead<void>> {
  const result = await requestJson<void>(`/roles/${encodeURIComponent(code)}`, {
    method: "DELETE",
    body: JSON.stringify(body),
  });
  if (result.ok) refreshAccess();
  return result;
}
