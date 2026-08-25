"use server";

import { revalidatePath } from "next/cache";

import {
  validateEmployeeEmail,
  type EmployeeDraft,
} from "@/lib/settings/employees";

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

async function readError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as
    | { detail?: string | Array<{ msg?: string }> }
    | null;
  if (typeof data?.detail === "string") return data.detail;
  if (Array.isArray(data?.detail) && data.detail.length > 0) {
    return (
      data.detail.map((item) => item.msg).filter(Boolean).join("; ") ||
      `Ошибка API (${response.status})`
    );
  }
  return `Ошибка API (${response.status})`;
}

function revalidateEmployees(employeeId?: number) {
  revalidatePath("/settings/organizations/employees");
  if (employeeId != null) {
    revalidatePath(`/settings/organizations/employees/${employeeId}`);
  }
}

function payloadFromDraft(draft: EmployeeDraft) {
  return {
    full_name: draft.fullName,
    organization_id: draft.organizationId === "" ? 0 : draft.organizationId,
    position: draft.position,
    department: draft.department,
    phone: draft.phone,
    email: draft.email.trim() || null,
    employment_date: draft.employmentDate.trim() || null,
    is_active: draft.isActive,
  };
}

function validateDraft(draft: EmployeeDraft): string | null {
  if (!draft.fullName.trim()) return "Укажите ФИО";
  if (draft.organizationId === "") return "Выберите организацию";
  return validateEmployeeEmail(draft.email);
}

export async function createEmployeeRecord(
  draft: EmployeeDraft,
): Promise<{ ok: true; id: number } | { ok: false; message: string }> {
  const message = validateDraft(draft);
  if (message) return { ok: false, message };
  const response = await fetch(`${apiBaseUrl()}/employees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloadFromDraft(draft)),
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, message: await readError(response) };
  const body = (await response.json()) as { id: number };
  revalidateEmployees(body.id);
  return { ok: true, id: body.id };
}

export async function saveEmployeeRecord(
  employeeId: number,
  draft: EmployeeDraft,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const message = validateDraft(draft);
  if (message) return { ok: false, message };
  const response = await fetch(`${apiBaseUrl()}/employees/${employeeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloadFromDraft(draft)),
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, message: await readError(response) };
  revalidateEmployees(employeeId);
  return { ok: true };
}
