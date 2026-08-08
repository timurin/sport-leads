"use server";

import { revalidatePath } from "next/cache";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import type {
  PlatformUserAdmin,
  PlatformUserInviteDraft,
  PlatformUserProfileDraft,
  RoleCatalogItem,
} from "@/lib/platform-users";
import { profileDraftToPayload } from "@/lib/platform-users";

export type PlatformUsersLoadResult =
  | { ok: true; users: PlatformUserAdmin[]; roles: RoleCatalogItem[] }
  | { ok: false; status: number; message: string };

export type RoleToggleResult =
  | { ok: true; user: PlatformUserAdmin }
  | { ok: false; message: string };

export type InviteUserResult =
  | { ok: true; user: PlatformUserAdmin; temporary_password: string }
  | { ok: false; message: string };

export type ProfileUpdateResult =
  | { ok: true; user: PlatformUserAdmin }
  | { ok: false; message: string };

export type PasswordActionResult =
  | { ok: true }
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
    email: raw.email ?? null,
    phone: raw.phone ?? null,
    department: raw.department ?? null,
    position: raw.position ?? null,
    manager_platform_user_id: raw.manager_platform_user_id ?? null,
    language: raw.language ?? "ru",
    invite_status: raw.invite_status ?? "active",
    last_activity_at: raw.last_activity_at ?? null,
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

export async function invitePlatformUser(
  draft: PlatformUserInviteDraft,
): Promise<InviteUserResult> {
  const auth = await sessionAuthHeaders();
  const payload: Record<string, unknown> = {
    login: draft.login.trim(),
    display_name: draft.display_name.trim(),
    email: draft.email.trim() || null,
    phone: draft.phone.trim() || null,
    department: draft.department.trim() || null,
    position: draft.position.trim() || null,
    role_codes: draft.role_codes,
  };
  const password = draft.temporary_password.trim();
  if (password) {
    payload.temporary_password = password;
  }
  const response = await fetch(`${apiBaseUrl()}/platform-users/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const body = (await response.json()) as {
    user: PlatformUserAdmin;
    temporary_password: string;
  };
  revalidatePath(USERS_PATH);
  return {
    ok: true,
    user: normalizeUser(body.user),
    temporary_password: body.temporary_password,
  };
}

export async function updatePlatformUserProfile(
  platformUserId: number,
  draft: PlatformUserProfileDraft,
): Promise<ProfileUpdateResult> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/platform-users/${platformUserId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify(profileDraftToPayload(draft)),
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

export async function changeOwnPassword(payload: {
  current_password: string;
  new_password: string;
}): Promise<PasswordActionResult> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  return { ok: true };
}

export async function setPlatformUserPassword(
  platformUserId: number,
  newPassword: string,
): Promise<PasswordActionResult> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/platform-users/${platformUserId}/set-password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({ new_password: newPassword }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  return { ok: true };
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
