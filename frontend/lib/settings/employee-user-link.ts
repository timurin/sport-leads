/** Explicit Employee ↔ PlatformUser mapping. HR fields stay on Employee. */

export const LINK_EFFECT =
  "Привязка не копирует ФИО и не меняет роли, пароль или вход.";

export const UNLINK_EFFECT =
  "Отвязка исправляет связь. Доступ, роли и пароль не меняются.";

export const MAPPING_REFRESH_PATHS = [
  "/settings/users",
  "/settings/organizations/employees",
  "/settings/employees",
] as const;

export type MappingAccount = {
  id: number;
  login: string;
  displayName: string;
  employeeId: number | null;
  active?: boolean;
  inviteStatus?: string;
};

export type MappingEmployee = {
  id: number;
  fullName: string;
  isActive: boolean;
};

export type DirectoryRead =
  | { ok: true; accounts: MappingAccount[] }
  | { ok: false; status: number | null; message: string };

export type EmployeeAccessView =
  | { state: "linked"; account: MappingAccount }
  | { state: "unlinked" }
  | { state: "forbidden"; message: string }
  | { state: "unavailable"; message: string };

export type MappingCommand =
  | {
      ok: true;
      accountId: number;
      body: { employee_id: number; reason: string } | { expected_employee_id: number; reason: string };
    }
  | { ok: false; message: string };

function cleanReason(reason: string): { ok: true; reason: string } | { ok: false; message: string } {
  const value = reason.trim();
  if (!value) return { ok: false, message: "Укажите причину связи." };
  if (value.length > 500) return { ok: false, message: "Причина не длиннее 500 символов." };
  return { ok: true, reason: value };
}

export function employeeAccessView(
  read: DirectoryRead,
  employeeId: number,
): EmployeeAccessView {
  if (!read.ok) {
    if (read.status === 401 || read.status === 403) {
      return { state: "forbidden", message: read.message };
    }
    return { state: "unavailable", message: read.message };
  }
  const linked = read.accounts.filter((account) => account.employeeId === employeeId);
  if (linked.length > 1) {
    return {
      state: "unavailable",
      message: "Несколько учёток указывают на одного сотрудника. Связь не изменена.",
    };
  }
  if (linked.length === 1) return { state: "linked", account: linked[0] };
  return { state: "unlinked" };
}

export function freeAccounts(accounts: MappingAccount[]): MappingAccount[] {
  return accounts.filter((account) => account.employeeId == null);
}

export function freeEmployees(
  employees: MappingEmployee[],
  accounts: MappingAccount[],
  includeArchived: boolean,
): MappingEmployee[] {
  const taken = new Set(
    accounts
      .map((account) => account.employeeId)
      .filter((id): id is number => id != null),
  );
  return employees.filter(
    (employee) => !taken.has(employee.id) && (includeArchived || employee.isActive),
  );
}

export function prepareLink(input: {
  account: MappingAccount | null;
  employeeId: number;
  employeeOwnerAccountId: number | null;
  reason: string;
}): MappingCommand {
  if (input.account == null) {
    return { ok: false, message: "Выберите свободную учётную запись." };
  }
  if (!Number.isInteger(input.employeeId) || input.employeeId < 1) {
    return { ok: false, message: "Выберите сотрудника." };
  }
  if (
    input.account.employeeId != null &&
    input.account.employeeId !== input.employeeId
  ) {
    return {
      ok: false,
      message: "Учётная запись уже связана с другим сотрудником. Сначала отвяжите её.",
    };
  }
  if (
    input.employeeOwnerAccountId != null &&
    input.employeeOwnerAccountId !== input.account.id
  ) {
    return {
      ok: false,
      message: "Сотрудник уже связан с другой учётной записью. Сначала отвяжите её.",
    };
  }
  const reason = cleanReason(input.reason);
  if (!reason.ok) return reason;
  return {
    ok: true,
    accountId: input.account.id,
    body: { employee_id: input.employeeId, reason: reason.reason },
  };
}

export function prepareUnlink(input: {
  accountId: number;
  expectedEmployeeId: number | null;
  reason: string;
  confirmed: boolean;
}): MappingCommand {
  if (!input.confirmed) {
    return { ok: false, message: "Подтвердите отвязку." };
  }
  if (input.expectedEmployeeId == null || input.expectedEmployeeId < 1) {
    return { ok: false, message: "Нет подтверждённого сотрудника для отвязки." };
  }
  const reason = cleanReason(input.reason);
  if (!reason.ok) return reason;
  return {
    ok: true,
    accountId: input.accountId,
    body: { expected_employee_id: input.expectedEmployeeId, reason: reason.reason },
  };
}

export function interpretMappingResponse(status: number | null, ok: boolean): {
  success: boolean;
  conflict: boolean;
  keepSelection: boolean;
} {
  if (ok) return { success: true, conflict: false, keepSelection: false };
  return { success: false, conflict: status === 409, keepSelection: true };
}
