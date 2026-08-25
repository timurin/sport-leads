"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { EmployeeCreateDrawer } from "@/components/settings/employee-create-drawer";
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
import { Input } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  employeeMatchesQuery,
  type EmployeeView,
} from "@/lib/settings/employees";
import type { OrganizationView } from "@/lib/settings/organizations";

type Props = {
  employees: EmployeeView[];
  organizations: OrganizationView[];
  loadError?: string;
};

/** PT-02 catalog list (`DS-PT-02`) for org HR employees. */
export function EmployeesWorkspace({ employees, organizations, loadError }: Props) {
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(
    () => employees.filter((item) => employeeMatchesQuery(item, query)),
    [employees, query],
  );

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <PageToolbar
        start={(
          <label className="relative flex h-portal-control-default w-full min-w-0 items-center md:min-w-56 md:flex-1 lg:max-w-sm">
            <span className="sr-only">Поиск сотрудников</span>
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск: ФИО, должность, организация"
              aria-label="Поиск сотрудников"
            />
          </label>
        )}
        end={(
          <IconButton
            label="Создать сотрудника"
            variant="primary"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-3.5" />
          </IconButton>
        )}
      />

      {loadError ? (
        <InlineAlert
          className="rounded-none border-x-0 border-t-0 border-b"
          tone="danger"
          size="compact"
        >
          {loadError}
        </InlineAlert>
      ) : null}

      <div className="min-w-0 flex-1 p-portal-4 lg:p-portal-6">
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
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((employee) => (
                  <DataTableRow key={employee.id}>
                    <DataTableCell className="font-medium text-portal-text">
                      <Link
                        href={`/settings/organizations/employees/${employee.id}`}
                        className="text-portal-primary hover:underline"
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
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
            <ListTotals
              primary={`${filtered.length} из ${employees.length}`}
              secondary="Кадровый справочник организаций"
            />
          </DataTableFrame>
        )}
      </div>

      <EmployeeCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        organizations={organizations}
      />
    </PageLayout>
  );
}
