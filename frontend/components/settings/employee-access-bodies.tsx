import Link from "next/link";

import { AccessGroupEditor } from "@/components/settings/access-group-editor";
import { AccessMembershipEditor } from "@/components/settings/access-membership-editor";
import { UnmappedAccountPanel } from "@/components/settings/unmapped-account-panel";
import { PageContent, PageLayout } from "@/components/layout/page-layout";
import {
  accessGroupHref,
  employeeCardHref,
  employeesListHref,
  type EmployeeListFilters,
} from "@/lib/settings/employee-access-routes";
import type { EmployeeView } from "@/lib/settings/employees";
import type { MappingAccount, MappingEmployee } from "@/lib/settings/employee-user-link";
import type {
  AccessRead,
  AccessRole,
  EffectiveAccess,
} from "@/app/(workspace)/settings/employees/access-actions";
import type { loadGroupScreen } from "@/app/(workspace)/settings/employees/employee-screen-data";

export function EmployeeAccessMessage({
  title,
  message,
  href,
  linkLabel,
}: {
  title: string;
  message: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <section className="rounded-portal-lg border border-portal-border bg-portal-surface p-portal-6">
      <h1 className="text-portal-page font-semibold text-portal-text">{title}</h1>
      <p className="mt-portal-2 text-portal-body text-portal-muted">{message}</p>
      <p className="mt-portal-4">
        <Link href={href} className="font-semibold text-portal-primary hover:underline">
          {linkLabel}
        </Link>
      </p>
    </section>
  );
}

export function EmployeeAccessFrame({ children }: { children: React.ReactNode }) {
  return (
    <PageLayout>
      <PageContent width="wide" size="default">{children}</PageContent>
    </PageLayout>
  );
}

export function MatrixBody({
  employee,
  filters,
  directoryMessage,
  catalog,
  account,
  effective,
}: {
  employee: EmployeeView;
  filters: EmployeeListFilters;
  directoryMessage: string | null;
  catalog: AccessRead<{ permissions: { code: string; description: string | null }[]; roles: AccessRole[] }> | null;
  account: MappingAccount | null;
  effective: AccessRead<EffectiveAccess> | null;
}) {
  const back = employeeCardHref(employee.id, "access", filters);
  if (directoryMessage) {
    return <EmployeeAccessMessage title="Доступ не загружен" message={directoryMessage} href={back} linkLabel="К карточке" />;
  }
  if (!catalog?.ok) {
    return (
      <EmployeeAccessMessage
        title="Каталог групп недоступен"
        message={catalog?.message ?? "Недостаточно прав admin.roles.assign."}
        href={back}
        linkLabel="К карточке"
      />
    );
  }
  if (!account) {
    return (
      <EmployeeAccessMessage
        title="Нет учётной записи"
        message="Сначала свяжите сотрудника с учётной записью. Группы без учётки не назначаются."
        href={back}
        linkLabel="К карточке"
      />
    );
  }
  if (!effective?.ok) {
    return (
      <EmployeeAccessMessage
        title="Права не загружены"
        message={effective?.message ?? "Эффективные права не получены."}
        href={back}
        linkLabel="К карточке"
      />
    );
  }
  return (
    <div className="space-y-portal-3">
      <Link href={back} className="text-portal-caption font-semibold text-portal-primary hover:underline">
        К карточке
      </Link>
      <AccessMembershipEditor
        employeeId={employee.id}
        platformUserId={account.id}
        initial={effective.data}
        roles={catalog.data.roles}
      />
    </div>
  );
}

export function GroupBody({
  screen,
}: {
  screen: Awaited<ReturnType<typeof loadGroupScreen>>;
}) {
  const back = screen.employee
    ? employeeCardHref(screen.employee.id, "access", screen.filters)
    : employeesListHref(screen.filters);
  if (!screen.catalog.ok) {
    return (
      <EmployeeAccessMessage
        title="Каталог групп недоступен"
        message={screen.catalog.message}
        href={back}
        linkLabel="Назад"
      />
    );
  }
  if (!screen.creating && screen.role && !screen.role.ok) {
    return (
      <EmployeeAccessMessage
        title="Группа не загружена"
        message={screen.role.message}
        href={back}
        linkLabel="Назад"
      />
    );
  }
  return (
    <div className="space-y-portal-3">
      <Link href={back} className="text-portal-caption font-semibold text-portal-primary hover:underline">
        {screen.employee ? "К карточке" : "К сотрудникам"}
      </Link>
      <AccessGroupEditor
        creating={screen.creating}
        role={screen.role && screen.role.ok ? screen.role.data : null}
        permissions={screen.catalog.data.permissions}
      />
    </div>
  );
}

export function AccountBody({
  account,
  accounts,
  employees,
  employeesError,
  roles,
  effective,
  message,
}: {
  account: MappingAccount | null;
  accounts: MappingAccount[];
  employees: MappingEmployee[];
  employeesError: string | null;
  roles: AccessRole[];
  effective: AccessRead<EffectiveAccess> | null;
  message: string | null;
}) {
  if (message || !account) {
    return (
      <EmployeeAccessMessage
        title="Учётная запись не загружена"
        message={message ?? "Учётная запись не найдена."}
        href={employeesListHref()}
        linkLabel="К сотрудникам"
      />
    );
  }
  return (
    <UnmappedAccountPanel
      account={account}
      accounts={accounts}
      employees={employees}
      employeesError={employeesError}
      roles={roles}
      effective={effective}
    />
  );
}

export function GroupIndexBody({
  roles,
  error,
  employee,
  filters,
}: {
  roles: AccessRole[];
  error: string | null;
  employee: EmployeeView | null;
  filters: EmployeeListFilters;
}) {
  const back = employee
    ? employeeCardHref(employee.id, "access", filters)
    : employeesListHref(filters);
  if (error) {
    return <EmployeeAccessMessage title="Каталог групп недоступен" message={error} href={back} linkLabel="Назад" />;
  }
  return (
    <div className="space-y-portal-3">
      <Link href={back} className="text-portal-caption font-semibold text-portal-primary hover:underline">
        {employee ? "К карточке" : "К сотрудникам"}
      </Link>
      <Link
        href={accessGroupHref("new", employee?.id, filters)}
        className="block text-portal-caption font-semibold text-portal-primary hover:underline"
      >
        Новая группа
      </Link>
      <ul className="space-y-2">
        {roles.map((role) => (
          <li key={role.code}>
            <Link
              href={accessGroupHref(role.code, employee?.id, filters)}
              className="font-semibold text-portal-primary hover:underline"
            >
              {role.name} ({role.code})
            </Link>
            <span className="text-portal-caption text-portal-muted">
              {role.is_system ? " · системная" : ""} · учёток {role.member_count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
