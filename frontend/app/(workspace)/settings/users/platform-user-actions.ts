"use server";

import { revalidatePath } from "next/cache";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import type {
  PlatformUserAdmin,
  RoleCatalogItem,
} from "@/lib/platform-users";

export type PlatformUsersLoadResult =
  | { ok: true; users: PlatformUserAdmin[]; roles: RoleCatalogItem[] }
  | { ok: false; status: number; message: string };

export type RoleToggleResult =
  | { ok: true; user: PlatformUserAdmin }
  | { ok: false; message: string };

const USERS_PATH = "/settings/users";

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
  if (response.status === 401) return "Требуется вход";
  if (response.status === 403) return "Недостаточно прав для управления ролями";
  return `Ошибка API (${response.status})`;
}

function normalizeUser(raw: PlatformUserAdmin): PlatformUserAdmin {
  return {
    ...raw,
    roles: raw.roles ?? [],
    permissions: raw.permissions ?? [],
  };
}

export async function loadPlatformUsersAdmin(): Promise<PlatformUsersLoadResult> {
  const auth = await sessionAuthHeaders();
  const [usersResponse, rolesResponse] = await Promise.all([
    fetch(`${apiBaseUrl()}/platform-users?limit=500`, {
      headers: { ...auth },
      cache: "no-store",
    }),
    fetch(`${apiBaseUrl()}/roles`, {
      headers: { ...auth },
      cache: "no-store",
    }),
  ]);

  if (!usersResponse.ok) {
    return {
      ok: false,
      status: usersResponse.status,
      message: await readError(usersResponse),
    };
  }
  if (!rolesResponse.ok) {
    return {
      ok: false,
      status: rolesResponse.status,
      message: await readError(rolesResponse),
    };
  }

  const usersBody = (await usersResponse.json()) as {
    items: PlatformUserAdmin[];
  };
  const rolesBody = (await rolesResponse.json()) as {
    items: RoleCatalogItem[];
  };
  return {
    ok: true,
    users: usersBody.items.map(normalizeUser),
    roles: rolesBody.items,
  };
}

export async function assignPlatformUserRole(
  platformUserId: number,
  roleCode: string,
): Promise<RoleToggleResult> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/platform-users/${platformUserId}/roles`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({ role_code: roleCode }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const user = normalizeUser((await response.json()) as PlatformUserAdmin);
  revalidatePath(USERS_PATH);
  return { ok: true, user };
}

export async function revokePlatformUserRole(
  platformUserId: number,
  roleCode: string,
): Promise<RoleToggleResult> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/platform-users/${platformUserId}/roles/${encodeURIComponent(roleCode)}`,
    {
      method: "DELETE",
      headers: { ...auth },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const user = normalizeUser((await response.json()) as PlatformUserAdmin);
  revalidatePath(USERS_PATH);
  return { ok: true, user };
}
