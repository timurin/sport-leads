"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  linkAccountToEmployee,
  unlinkAccountFromEmployee,
} from "@/app/(workspace)/settings/users/employee-link-actions";
import {
  assignPlatformUserRole,
  revokePlatformUserRole,
} from "@/app/(workspace)/settings/users/platform-user-actions";
import { PlatformAccessMatrix } from "@/components/settings/platform-access-matrix";
import { PlatformUserInviteDrawer } from "@/components/settings/platform-user-invite-drawer";
import { PlatformUserProfilePanel } from "@/components/settings/platform-user-profile-panel";
import { Button } from "@/components/ui/button";
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
  formatUserActivity,
  roleLabel,
  sortRolesByCode,
  userHasRole,
  userInitials,
  userStatusLabel,
  userStatusTone,
  type PlatformUserAdmin,
  type PlatformUserListStatus,
  type RoleCatalogItem,
} from "@/lib/platform-users";

const statusFilters: Array<{ id: PlatformUserListStatus; label: string }> = [
  { id: "all", label: "Все" },
  { id: "active", label: "Активные" },
  { id: "invited", label: "Приглашённые" },
  { id: "pending", label: "Ожидают" },
  { id: "inactive", label: "Отключённые" },
];

/** PT-02 admin list: users + role assign + profile cabinet (17.1.2.5 / 21.2–21.3). */
export function PlatformUsersWorkspace({
  users: initialUsers,
  roles: initialRoles,
  viewerUserId,
  employees,
  employeesError = null,
  initialUserId = null,
}: {
  users: PlatformUserAdmin[];
  roles: RoleCatalogItem[];
  viewerUserId: number | null;
  employees: Array<{ id: number; fullName: string; isActive: boolean }>;
  employeesError?: string | null;
  initialUserId?: number | null;
}) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [users, setUsers] = useState(initialUsers);
  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<PlatformUserListStatus>("all");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState<number | null>(initialUserId);

  const roles = useMemo(
    () => sortRolesByCode(initialRoles),
    [initialRoles],
  );
  const filtered = useMemo(
    () => filterPlatformUsers(users, query, statusFilter),
    [users, query, statusFilter],
  );
  const profileUser =
    profileUserId == null
      ? null
      : (users.find((row) => row.id === profileUserId) ?? null);
  const employeeName = useMemo(() => {
    const names = new Map(employees.map((row) => [row.id, row.fullName]));
    return (employeeId: number) => names.get(employeeId) ?? null;
  }, [employees]);
  const applyMapping = (platformUserId: number, employeeId: number | null) => {
    setUsers((current) =>
      current.map((row) =>
        row.id === platformUserId ? { ...row, employee_id: employeeId } : row,
      ),
    );
    router.refresh();
  };

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
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по id, логину, имени, email или отделу"
              className="min-w-0 w-full flex-1"
              aria-label="Поиск пользователей"
            />
            <div
              className="flex shrink-0 flex-wrap gap-1"
              role="group"
              aria-label="Фильтр статуса"
            >
              {statusFilters.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  size="compact"
                  variant={statusFilter === item.id ? "primary" : "secondary"}
                  className="h-9 px-3 text-xs"
                  onClick={() => setStatusFilter(item.id)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
        }
        end={
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              variant={matrixOpen ? "primary" : "secondary"}
              className="h-9"
              onClick={() => setMatrixOpen((current) => !current)}
            >
              Матрица доступа
            </Button>
            <Button
              type="button"
              variant="primary"
              className="h-9"
              onClick={() => setInviteOpen(true)}
            >
              Пригласить
            </Button>
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto p-portal-4 sm:p-portal-6">
        {error ? (
          <p className="mb-portal-4 text-portal-body text-portal-danger" role="alert">
            {error}
          </p>
        ) : null}

        {matrixOpen ? (
          <div className="mb-portal-6">
            <PlatformAccessMatrix roles={roles} />
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <EmptyState
            title="Нет пользователей"
            description={
              users.length === 0
                ? "В системе пока нет PlatformUser."
                : "Измените поиск или фильтр статуса."
            }
          />
        ) : (
          <DataTableFrame>
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>ID</DataTableHeaderCell>
                  <DataTableHeaderCell>Имя</DataTableHeaderCell>
                  <DataTableHeaderCell>Логин</DataTableHeaderCell>
                  <DataTableHeaderCell>Сотрудник</DataTableHeaderCell>
                  <DataTableHeaderCell>Отдел</DataTableHeaderCell>
                  <DataTableHeaderCell>Email</DataTableHeaderCell>
                  <DataTableHeaderCell>Телефон</DataTableHeaderCell>
                  <DataTableHeaderCell>Активность</DataTableHeaderCell>
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
                  <DataTableRow
                    key={user.id}
                    className="cursor-pointer"
                    onClick={() => setProfileUserId(user.id)}
                  >
                    <DataTableCell className="tabular-nums text-portal-muted">
                      {user.id}
                    </DataTableCell>
                    <DataTableCell>
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-portal-primary-soft text-[11px] font-semibold text-portal-primary"
                          aria-hidden="true"
                        >
                          {userInitials(user.display_name)}
                        </span>
                        <span className="min-w-0 truncate font-medium text-portal-text">
                          {user.display_name}
                        </span>
                      </div>
                    </DataTableCell>
                    <DataTableCell className="font-medium text-portal-text">
                      {user.login}
                    </DataTableCell>
                    <DataTableCell onClick={(event) => event.stopPropagation()}>
                      {typeof user.employee_id === "number" ? (
                        <Link
                          href={`/settings/employees/${user.employee_id}?tab=access`}
                          className="text-portal-primary hover:underline"
                        >
                          {employeeName(user.employee_id) ?? `#${user.employee_id}`}
                        </Link>
                      ) : user.employee_id === undefined ? (
                        "—"
                      ) : (
                        "Нет"
                      )}
                    </DataTableCell>
                    <DataTableCell className="text-portal-muted">
                      {user.department?.trim() || "—"}
                    </DataTableCell>
                    <DataTableCell className="text-portal-muted">
                      {user.email?.trim() || "—"}
                    </DataTableCell>
                    <DataTableCell className="text-portal-muted">
                      {user.phone?.trim() || "—"}
                    </DataTableCell>
                    <DataTableCell className="text-portal-muted tabular-nums">
                      {formatUserActivity(user.last_activity_at)}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge size="compact" tone={userStatusTone(user)}>
                        {userStatusLabel(user)}
                      </StatusBadge>
                    </DataTableCell>
                    {roles.map((role) => {
                      const checked = userHasRole(user, role.code);
                      const key = `${user.id}:${role.code}`;
                      return (
                        <DataTableCell
                          key={role.code}
                          onClick={(event) => event.stopPropagation()}
                        >
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
        secondary="Список Пользователи (21.4.2) · кабинет↔матрица · роли · invite"
      />

      <PlatformUserInviteDrawer
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        roles={roles}
        onInvited={(user) => {
          setUsers((current) => {
            if (current.some((row) => row.id === user.id)) {
              return current.map((row) => (row.id === user.id ? user : row));
            }
            return [...current, user].sort((a, b) =>
              a.login.localeCompare(b.login),
            );
          });
        }}
      />

      <PlatformUserProfilePanel
        open={profileUser != null}
        user={profileUser}
        users={users}
        roles={roles}
        viewerUserId={viewerUserId}
        roleBusyKey={busyKey}
        onClose={() => setProfileUserId(null)}
        onSaved={(saved) => {
          setUsers((current) =>
            current.map((row) =>
              row.id === saved.id
                ? {
                    ...saved,
                    employee_id:
                      saved.employee_id === undefined
                        ? row.employee_id
                        : saved.employee_id,
                  }
                : row,
            ),
          );
        }}
        onToggleRole={async (target, roleCode, nextChecked) => {
          await toggleRole(target, roleCode, nextChecked);
        }}
        onOpenAccessMatrix={() => {
          setProfileUserId(null);
          setMatrixOpen(true);
        }}
        employees={employees}
        employeesError={employeesError}
        onRefreshMapping={() => router.refresh()}
        onLinkEmployee={async (accountId, employeeId, reason) => {
          const result = await linkAccountToEmployee(accountId, employeeId, reason);
          if (result.ok) applyMapping(result.platformUserId, result.employeeId);
          return result.ok
            ? { ok: true }
            : { ok: false, message: result.message, conflict: result.conflict };
        }}
        onUnlinkEmployee={async (accountId, expectedEmployeeId, reason) => {
          const result = await unlinkAccountFromEmployee(
            accountId,
            expectedEmployeeId,
            reason,
          );
          if (result.ok) applyMapping(result.platformUserId, result.employeeId);
          return result.ok
            ? { ok: true }
            : { ok: false, message: result.message, conflict: result.conflict };
        }}
      />
    </div>
  );
}
