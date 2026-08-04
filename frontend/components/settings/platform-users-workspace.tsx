"use client";

import { useMemo, useState } from "react";

import {
  assignPlatformUserRole,
  revokePlatformUserRole,
} from "@/app/(workspace)/settings/users/platform-user-actions";
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
import { Checkbox, Input } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import {
  filterPlatformUsers,
  roleLabel,
  sortRolesByCode,
  userHasRole,
  type PlatformUserAdmin,
  type RoleCatalogItem,
} from "@/lib/platform-users";

/** PT-02 admin list: assign/revoke roles on PlatformUser (17.1.2.5). */
export function PlatformUsersWorkspace({
  users: initialUsers,
  roles: initialRoles,
}: {
  users: PlatformUserAdmin[];
  roles: RoleCatalogItem[];
}) {
  const { push: pushToast } = useToast();
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roles = useMemo(
    () => sortRolesByCode(initialRoles),
    [initialRoles],
  );
  const filtered = useMemo(
    () => filterPlatformUsers(users, query),
    [users, query],
  );

  const toggleRole = async (
    user: PlatformUserAdmin,
    roleCode: string,
    nextChecked: boolean,
  ) => {
    const key = `${user.id}:${roleCode}`;
    setBusyKey(key);
    setError(null);
    const result = nextChecked
      ? await assignPlatformUserRole(user.id, roleCode)
      : await revokePlatformUserRole(user.id, roleCode);
    setBusyKey(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setUsers((current) =>
      current.map((row) => (row.id === result.user.id ? result.user : row)),
    );
    pushToast(
      nextChecked
        ? `Роль «${roleLabel(roleCode)}» назначена`
        : `Роль «${roleLabel(roleCode)}» снята`,
      "success",
    );
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageToolbar
        start={
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по логину, имени или роли"
            className="min-w-0 w-full flex-1"
            aria-label="Поиск пользователей"
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-auto p-portal-4 sm:p-portal-6">
        {error ? (
          <p className="mb-portal-4 text-portal-body text-portal-danger" role="alert">
            {error}
          </p>
        ) : null}

        {filtered.length === 0 ? (
          <EmptyState
            title="Нет пользователей"
            description={
              users.length === 0
                ? "В системе пока нет PlatformUser."
                : "Измените поисковый запрос."
            }
          />
        ) : (
          <DataTableFrame>
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>Логин</DataTableHeaderCell>
                  <DataTableHeaderCell>Имя</DataTableHeaderCell>
                  <DataTableHeaderCell>Статус</DataTableHeaderCell>
                  {roles.map((role) => (
                    <DataTableHeaderCell key={role.code}>
                      {roleLabel(role.code)}
                    </DataTableHeaderCell>
                  ))}
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((user) => (
                  <DataTableRow key={user.id}>
                    <DataTableCell className="font-medium text-portal-text">
                      {user.login}
                    </DataTableCell>
                    <DataTableCell>{user.display_name}</DataTableCell>
                    <DataTableCell>
                      <StatusBadge
                        size="compact"
                        tone={user.is_active ? "success" : "neutral"}
                      >
                        {user.is_active ? "Активен" : "Отключён"}
                      </StatusBadge>
                    </DataTableCell>
                    {roles.map((role) => {
                      const checked = userHasRole(user, role.code);
                      const key = `${user.id}:${role.code}`;
                      return (
                        <DataTableCell key={role.code}>
                          <Checkbox
                            checked={checked}
                            disabled={busyKey === key}
                            onChange={(event) =>
                              toggleRole(user, role.code, event.target.checked)
                            }
                            aria-label={`${user.login}: ${roleLabel(role.code)}`}
                          />
                        </DataTableCell>
                      );
                    })}
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        )}
      </div>

      <ListTotals
        primary={`Показано: ${filtered.length} из ${users.length}`}
        secondary="Назначение ролей PlatformUser (ADR-024)"
      />
    </div>
  );
}
