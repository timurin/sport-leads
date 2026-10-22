import "server-only";

import { loadAccountDirectory } from "@/app/(workspace)/settings/users/employee-link-actions";
import { getMe } from "@/lib/auth/session";
import {
  hasPermission,
  PERM_ADMIN_ROLES_ASSIGN,
} from "@/lib/auth/session-mapping";
import {
  normalizeEmployeeFilters,
  type EmployeeCardTab,
  type EmployeeListFilters,
} from "@/lib/settings/employee-access-routes";
import { getEmployeeDetail, getEmployeesList } from "@/lib/settings/employees-api";
import type { EmployeeView } from "@/lib/settings/employees";
import { getOrganizationsList } from "@/lib/settings/organizations-api";
import type { OrganizationView } from "@/lib/settings/organizations";
import type { MappingAccount } from "@/lib/settings/employee-user-link";
import {
  loadAccessCatalog,
  loadEffectiveAccess,
  loadRole,
} from "@/app/(workspace)/settings/employees/access-actions";

export type QueryInput = Record<string, string | string[] | undefined>;

export async function loadEmployeeDirectory(query: QueryInput) {
  const filters = normalizeEmployeeFilters(query);
  const me = await getMe();
  const canAssign = hasPermission(me, PERM_ADMIN_ROLES_ASSIGN);
  const [employees, organizations, directory, catalog] = await Promise.all([
    getEmployeesList(false),
    getOrganizationsList(false),
    canAssign ? loadAccountDirectory() : Promise.resolve(null),
    canAssign ? loadAccessCatalog() : Promise.resolve(null),
  ]);
  return { filters, canAssign, employees, organizations, directory, catalog };
}

export async function loadEmployeeCard(employeeId: string, query: QueryInput): Promise<{
  filters: EmployeeListFilters;
  tab: EmployeeCardTab;
  employee: EmployeeView | null;
  notFound: boolean;
  message: string | null;
  organizations: OrganizationView[];
}> {
  const filters = normalizeEmployeeFilters(query);
  const tab: EmployeeCardTab = query.tab === "access" ? "access" : "main";
  const [result, organizations] = await Promise.all([
    getEmployeeDetail(employeeId),
    getOrganizationsList(false),
  ]);
  return {
    filters,
    tab,
    employee: result.ok ? result.employee : null,
    notFound: !result.ok && result.notFound === true,
    message: result.ok ? null : result.message,
    organizations: organizations.ok ? organizations.items : [],
  };
}

export async function loadMatrixScreen(employeeId: string, query: QueryInput) {
  const card = await loadEmployeeCard(employeeId, query);
  if (!card.employee) return { card, account: null as MappingAccount | null, catalog: null, effective: null, directoryMessage: null as string | null };
  const [directory, catalog] = await Promise.all([loadAccountDirectory(), loadAccessCatalog()]);
  const account = directory.ok
    ? (directory.accounts.find((item) => item.employeeId === card.employee?.id) ?? null)
    : null;
  const effective = account ? await loadEffectiveAccess(account.id) : null;
  return {
    card,
    account,
    catalog,
    effective,
    directoryMessage: directory.ok ? null : directory.message,
  };
}

export async function loadGroupScreen(roleCode: string, query: QueryInput) {
  const filters = normalizeEmployeeFilters(query);
  const employeeParam = Array.isArray(query.employee) ? query.employee[0] : query.employee;
  const employeeId = employeeParam && /^\d+$/.test(employeeParam) ? Number(employeeParam) : null;
  const [catalog, employee] = await Promise.all([
    loadAccessCatalog(),
    employeeId == null ? Promise.resolve(null) : getEmployeeDetail(String(employeeId)),
  ]);
  const role = roleCode === "new" ? null : await loadRole(roleCode);
  return {
    filters,
    employeeId,
    employee: employee && employee.ok ? employee.employee : null,
    catalog,
    role,
    creating: roleCode === "new",
  };
}

export async function loadAccountScreen(platformUserId: string) {
  const id = /^\d+$/.test(platformUserId) ? Number(platformUserId) : null;
  if (id == null) {
    return {
      id: null,
      directory: null,
      employees: null,
      catalog: null,
      account: null,
      effective: null,
    };
  }
  const [directory, employees, catalog] = await Promise.all([
    loadAccountDirectory(),
    getEmployeesList(false),
    loadAccessCatalog(),
  ]);
  const account = directory.ok ? (directory.accounts.find((item) => item.id === id) ?? null) : null;
  const effective = account ? await loadEffectiveAccess(account.id) : null;
  return { id, directory, employees, catalog, account, effective };
}
