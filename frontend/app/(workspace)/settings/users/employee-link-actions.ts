"use server";

import { revalidatePath } from "next/cache";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import {
  MAPPING_REFRESH_PATHS,
  type DirectoryRead,
  type MappingAccount,
} from "@/lib/settings/employee-user-link";

export type MappingWriteResult =
  | { ok: true; platformUserId: number; employeeId: number | null }
  | { ok: false; status: number | null; message: string; conflict: boolean };

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
  } catch {
    /* ignore */
  }
  if (response.status === 401) return "Требуется вход.";
  if (response.status === 403) return "Недостаточно прав admin.roles.assign.";
  if (response.status === 404) return "Сотрудник или учётная запись не найдены.";
  if (response.status === 409) {
    return "Связь занята или уже другая. Данные обновлены, другой id не подставлен.";
  }
  return `Ошибка API (${response.status}). Связь не изменена.`;
}

function refreshMapping(employeeId: number | null): void {
  for (const path of MAPPING_REFRESH_PATHS) revalidatePath(path);
  revalidatePath("/settings/organizations/employees/[employeeId]", "page");
  revalidatePath("/settings/employees/[employeeId]", "page");
  if (employeeId != null) {
    revalidatePath(`/settings/organizations/employees/${employeeId}`);
    revalidatePath(`/settings/employees/${employeeId}`);
  }
}

export async function loadAccountDirectory(): Promise<DirectoryRead> {
  try {
    const auth = await sessionAuthHeaders();
    const response = await fetch(`${apiBaseUrl()}/platform-users?limit=500`, {
      headers: { ...auth },
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, status: response.status, message: await readError(response) };
    }
    const body = (await response.json()) as {
      items?: Array<Record<string, unknown>>;
    };
    const accounts: MappingAccount[] = [];
    for (const item of body.items ?? []) {
      if (!Object.prototype.hasOwnProperty.call(item, "employee_id")) {
        return {
          ok: false,
          status: response.status,
          message: "Список учёток не содержит связь с сотрудником. Связь не изменена.",
        };
      }
      const id = item.id;
      const employeeId = item.employee_id;
      if (typeof id !== "number") continue;
      accounts.push({
        id,
        login: typeof item.login === "string" ? item.login : String(id),
        displayName: typeof item.display_name === "string" ? item.display_name : "",
        employeeId: typeof employeeId === "number" ? employeeId : null,
        active: item.is_active !== false,
        inviteStatus: typeof item.invite_status === "string" ? item.invite_status : "active",
      });
    }
    return { ok: true, accounts };
  } catch {
    return {
      ok: false,
      status: null,
      message: "Нет связи с сервером. Связь не изменена.",
    };
  }
}

async function writeMapping(
  accountId: number,
  path: "employee-link" | "employee-unlink",
  body: { employee_id: number; reason: string } | { expected_employee_id: number; reason: string },
  refreshEmployeeId: number | null,
): Promise<MappingWriteResult> {
  try {
    const auth = await sessionAuthHeaders();
    const response = await fetch(
      `${apiBaseUrl()}/platform-users/${accountId}/${path}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: await readError(response),
        conflict: response.status === 409,
      };
    }
    const saved = (await response.json()) as {
      platform_user_id: number;
      employee_id: number | null;
    };
    refreshMapping(refreshEmployeeId);
    if (saved.employee_id != null) refreshMapping(saved.employee_id);
    return {
      ok: true,
      platformUserId: saved.platform_user_id,
      employeeId: saved.employee_id,
    };
  } catch {
    return {
      ok: false,
      status: null,
      message: "Нет связи с сервером. Связь не изменена.",
      conflict: false,
    };
  }
}

export async function linkAccountToEmployee(
  accountId: number,
  employeeId: number,
  reason: string,
): Promise<MappingWriteResult> {
  return writeMapping(
    accountId,
    "employee-link",
    { employee_id: employeeId, reason },
    employeeId,
  );
}

export async function unlinkAccountFromEmployee(
  accountId: number,
  expectedEmployeeId: number,
  reason: string,
): Promise<MappingWriteResult> {
  return writeMapping(
    accountId,
    "employee-unlink",
    { expected_employee_id: expectedEmployeeId, reason },
    expectedEmployeeId,
  );
}
