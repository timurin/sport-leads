/** Canonical employee/access URLs. Account ids are never treated as employee ids. */

export type EmployeeListFilters = {
  q?: string;
  status?: string;
  organizationId?: string;
};

export type EmployeeCardTab = "main" | "access";

const STATUSES = new Set(["all", "active", "archived", "linked", "unlinked"]);

export function normalizeEmployeeFilters(
  input: Record<string, string | string[] | undefined>,
): EmployeeListFilters {
  const first = (key: string) => {
    const value = input[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const status = first("status") ?? "";
  const organizationId = first("organization_id") ?? "";
  return {
    q: (first("q") ?? "").trim(),
    status: STATUSES.has(status) ? status : "all",
    organizationId: /^\d+$/.test(organizationId) ? organizationId : "",
  };
}

export function employeeFilterQuery(filters: EmployeeListFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.organizationId) params.set("organization_id", filters.organizationId);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function employeesListHref(filters: EmployeeListFilters = {}): string {
  return `/settings/employees${employeeFilterQuery(filters)}`;
}

export function employeeCardHref(
  employeeId: number,
  tab: EmployeeCardTab = "main",
  filters: EmployeeListFilters = {},
): string {
  const params = new URLSearchParams(employeeFilterQuery(filters).slice(1));
  if (tab === "access") params.set("tab", "access");
  const query = params.toString();
  return `/settings/employees/${employeeId}${query ? `?${query}` : ""}`;
}

export function accessMatrixHref(
  employeeId: number,
  filters: EmployeeListFilters = {},
): string {
  const params = new URLSearchParams(employeeFilterQuery(filters).slice(1));
  const query = params.toString();
  return `/settings/employees/${employeeId}/access-matrix${query ? `?${query}` : ""}`;
}

export function accessGroupsHref(
  employeeId?: number,
  filters: EmployeeListFilters = {},
): string {
  const params = new URLSearchParams(employeeFilterQuery(filters).slice(1));
  if (employeeId != null) params.set("employee", String(employeeId));
  const query = params.toString();
  return `/settings/employees/access-groups${query ? `?${query}` : ""}`;
}

export function accessGroupHref(
  roleCode: string,
  employeeId?: number,
  filters: EmployeeListFilters = {},
): string {
  const params = new URLSearchParams(employeeFilterQuery(filters).slice(1));
  if (employeeId != null) params.set("employee", String(employeeId));
  const query = params.toString();
  return `/settings/employees/access-groups/${encodeURIComponent(roleCode)}${query ? `?${query}` : ""}`;
}

export function accountExceptionHref(platformUserId: number): string {
  return `/settings/employees/accounts/${platformUserId}`;
}

export function accountFilterApplies(status: string | undefined, accountsKnown: boolean): boolean {
  return accountsKnown && (status === "linked" || status === "unlinked");
}

export function employeeAccountLabel(input: {
  known: boolean;
  forbidden: boolean;
  message?: string | null;
  account: { login: string; active?: boolean; inviteStatus?: string } | null;
}): string {
  if (!input.known) {
    if (input.forbidden) return "Недостаточно прав";
    return input.message?.trim() || "Нет данных";
  }
  if (!input.account) return "Нет";
  if (input.account.active === false) return `${input.account.login} · отключена`;
  if (input.account.inviteStatus === "invited") return `${input.account.login} · приглашена`;
  if (input.account.inviteStatus === "pending") return `${input.account.login} · ожидает`;
  return `${input.account.login} · активна`;
}

export function legacyEmployeeTarget(
  employeeId: string,
  query: Record<string, string | string[] | undefined>,
): string | null {
  if (!/^\d+$/.test(employeeId)) return null;
  const filters = normalizeEmployeeFilters(query);
  const tab = query.tab === "access" ? "access" : "main";
  return employeeCardHref(Number(employeeId), tab, filters);
}

export type UsersAliasResolution =
  | { kind: "forbidden" }
  | { kind: "list" }
  | { kind: "missing" }
  | { kind: "employee"; href: string }
  | { kind: "account"; href: string };

export function resolveUsersAlias(input: {
  canAssign: boolean;
  userId: string | null;
  employeeId: number | null;
  found: boolean;
}): UsersAliasResolution {
  if (!input.userId) return { kind: "list" };
  if (!/^\d+$/.test(input.userId)) return { kind: "missing" };
  if (!input.canAssign) return { kind: "forbidden" };
  if (!input.found) return { kind: "missing" };
  if (input.employeeId != null && input.employeeId > 0) {
    return { kind: "employee", href: employeeCardHref(input.employeeId, "access") };
  }
  return { kind: "account", href: accountExceptionHref(Number(input.userId)) };
}
