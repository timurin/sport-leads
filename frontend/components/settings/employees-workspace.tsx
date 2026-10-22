"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmployeeCreateDrawer } from "@/components/settings/employee-create-drawer";
import { useEmployeeNav } from "@/components/settings/employee-nav-context";
import { PlatformUserInviteDrawer } from "@/components/settings/platform-user-invite-drawer";
import { PageLayout } from "@/components/layout/page-layout";
import { Button, IconButton } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFrame,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input, Select } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  employeeMatchesQuery,
  type EmployeeView,
} from "@/lib/settings/employees";
import {
  accountExceptionHref,
  accountFilterApplies,
  employeeAccountLabel,
  employeeCardHref,
  employeesListHref,
  type EmployeeListFilters,
} from "@/lib/settings/employee-access-routes";
import type { OrganizationView } from "@/lib/settings/organizations";
import type { RoleCatalogItem } from "@/lib/platform-users";

type AccountBadge = {
  employeeId: number;
  login: string;
  active?: boolean;
  inviteStatus?: string;
};

type Props = {
  employees: EmployeeView[];
  organizations: OrganizationView[];
  loadError?: string;
  filters: EmployeeListFilters;
  accounts: AccountBadge[] | null;
  accountsForbidden: boolean;
  accountsMessage: string | null;
  inviteRoles: RoleCatalogItem[] | null;
};

/** PT-02 catalog list (`DS-PT-02`) for employees and platform access. */
export function EmployeesWorkspace({
  employees,
  organizations,
  loadError,
  filters,
  accounts,
  accountsForbidden,
  accountsMessage,
  inviteRoles,
}: Props) {
  const router = useRouter();
  const nav = useEmployeeNav();
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const accountsKnown = accounts != null;
  const byEmployee = useMemo(() => {
    const map = new Map<number, AccountBadge>();
    for (const account of accounts ?? []) map.set(account.employeeId, account);
    return map;
  }, [accounts]);

  useEffect(() => {
    if (nav && nav.scrollTop > 0) window.scrollTo(0, nav.scrollTop);
  }, [nav]);

  const replaceFilters = (patch: Partial<EmployeeListFilters>) => {
    router.replace(employeesListHref({ ...filters, ...patch }));
  };

  const filtered = employees.filter((employee) => {
    if (!employeeMatchesQuery(employee, filters.q ?? "")) return false;
    if (filters.organizationId && String(employee.organizationId) !== filters.organizationId) return false;
    if (filters.status === "active" && !employee.isActive) return false;
    if (filters.status === "archived" && employee.isActive) return false;
    if (accountFilterApplies(filters.status, accountsKnown)) {
      const linked = byEmployee.has(employee.id);
      if (filters.status === "linked" && !linked) return false;
      if (filters.status === "unlinked" && linked) return false;
    }
    return true;
  });

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <PageToolbar
        start={(
          <div className="flex w-full min-w-0 flex-col gap-2 md:flex-row md:items-center">
            <label className="relative flex h-portal-control-default w-full min-w-0 items-center md:min-w-56 md:flex-1 lg:max-w-sm">
              <span className="sr-only">Поиск сотрудников</span>
              <Input
                type="search"
                value={filters.q ?? ""}
                onChange={(event) => replaceFilters({ q: event.target.value })}
                placeholder="Поиск: ФИО, должность, организация"
                aria-label="Поиск сотрудников"
              />
            </label>
            <Select
              aria-label="Статус"
              value={filters.status || "all"}
              onChange={(event) => replaceFilters({ status: event.target.value })}
            >
              <option value="all">Все</option>
              <option value="active">Работает</option>
              <option value="archived">Архив</option>
              <option value="linked">Есть учётка</option>
              <option value="unlinked">Нет учётки</option>
            </Select>
            <Select
              aria-label="Организация"
              value={filters.organizationId ?? ""}
              onChange={(event) => replaceFilters({ organizationId: event.target.value })}
            >
              <option value="">Все организации</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </Select>
          </div>
        )}
        end={(
          <div className="flex items-center gap-2">
            {inviteRoles ? (
              <Button type="button" variant="secondary" onClick={() => setInviteOpen(true)}>
                Пригласить
              </Button>
            ) : null}
            <IconButton
              label="Создать сотрудника"
              variant="primary"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-3.5" />
            </IconButton>
          </div>
        )}
      />

      {loadError ? (
        <InlineAlert className="rounded-none border-x-0 border-t-0 border-b" tone="danger" size="compact">
          {loadError}
        </InlineAlert>
      ) : null}
      {!accountsKnown && (filters.status === "linked" || filters.status === "unlinked") ? (
        <InlineAlert className="rounded-none border-x-0 border-t-0 border-b" tone="warning" size="compact">
          Фильтр учётки недоступен: {accountsForbidden ? "недостаточно прав." : (accountsMessage ?? "нет данных.")}
        </InlineAlert>
      ) : null}

      <div className="min-w-0 flex-1 overflow-auto p-portal-4 lg:p-portal-6">
        {filtered.length === 0 ? (
          <EmptyState
            title={employees.length === 0 ? "Сотрудников пока нет" : "Ничего не найдено"}
            description={
              employees.length === 0
                ? "Создайте кадровую карточку — demo-записи не подставляются."
                : "Измените поисковый запрос."
            }
            size="compact"
            action={
              employees.length === 0 ? (
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  Создать сотрудника
                </Button>
              ) : null
            }
          />
        ) : (
          <DataTableFrame>
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>Сотрудник</DataTableHeaderCell>
                  <DataTableHeaderCell>Должность</DataTableHeaderCell>
                  <DataTableHeaderCell>Подразделение</DataTableHeaderCell>
                  <DataTableHeaderCell>Организация</DataTableHeaderCell>
                  <DataTableHeaderCell>Телефон</DataTableHeaderCell>
                  <DataTableHeaderCell>Статус</DataTableHeaderCell>
                  <DataTableHeaderCell>Учётка</DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((employee) => {
                  const account = byEmployee.get(employee.id) ?? null;
                  return (
                    <DataTableRow key={employee.id} data-employee-row={employee.id}>
                      <DataTableCell className="font-medium text-portal-text">
                        <Link
                          href={employeeCardHref(employee.id, "main", filters)}
                          className="inline-block text-portal-primary hover:underline"
                          onClick={() => nav?.setScrollTop(window.scrollY)}
                        >
                          {employee.fullName}
                        </Link>
                      </DataTableCell>
                      <DataTableCell>{employee.position || "—"}</DataTableCell>
                      <DataTableCell>{employee.department || "—"}</DataTableCell>
                      <DataTableCell>{employee.organizationName || "—"}</DataTableCell>
                      <DataTableCell>{employee.phone || "—"}</DataTableCell>
                      <DataTableCell>
                        <StatusBadge tone={employee.isActive ? "success" : "neutral"} size="compact">
                          {employee.isActive ? "Работает" : "Архив"}
                        </StatusBadge>
                      </DataTableCell>
                      <DataTableCell>
                        {employeeAccountLabel({
                          known: accountsKnown,
                          forbidden: accountsForbidden,
                          message: accountsMessage,
                          account,
                        })}
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
            <ListTotals
              primary={`${filtered.length} из ${employees.length}`}
              secondary="Сотрудники и доступ к платформе"
            />
          </DataTableFrame>
        )}
      </div>

      <EmployeeCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        organizations={organizations}
      />
      {inviteRoles ? (
        <PlatformUserInviteDrawer
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          roles={inviteRoles}
          onInvited={(user) => {
            setInviteOpen(false);
            router.push(accountExceptionHref(user.id));
          }}
        />
      ) : null}
    </PageLayout>
  );
}
