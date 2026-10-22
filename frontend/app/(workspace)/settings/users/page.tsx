import { redirect } from "next/navigation";

import { loadEmployeeLink } from "@/app/(workspace)/settings/employees/access-actions";
import { EmployeeAccessMessage } from "@/components/settings/employee-access-bodies";
import { PageContent, PageLayout } from "@/components/layout/page-layout";
import { getMe } from "@/lib/auth/session";
import {
  hasPermission,
  PERM_ADMIN_ROLES_ASSIGN,
} from "@/lib/auth/session-mapping";
import {
  employeesListHref,
  resolveUsersAlias,
} from "@/lib/settings/employee-access-routes";

export default async function PlatformUsersAliasPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const params = await searchParams;
  const userId = params.user?.trim() ? params.user : null;
  if (!userId) redirect(employeesListHref());

  const me = await getMe();
  const canAssign = hasPermission(me, PERM_ADMIN_ROLES_ASSIGN);
  if (!canAssign) {
    return (
      <PageLayout>
        <PageContent>
          <EmployeeAccessMessage
            title="Недостаточно прав"
            message="Нужно право admin.roles.assign. Связь учётки не запрашивалась."
            href={employeesListHref()}
            linkLabel="К сотрудникам"
          />
        </PageContent>
      </PageLayout>
    );
  }
  if (!/^\d+$/.test(userId)) {
    return (
      <PageLayout>
        <PageContent>
          <EmployeeAccessMessage
            title="Учётная запись не найдена"
            message="Некорректный идентификатор."
            href={employeesListHref()}
            linkLabel="К сотрудникам"
          />
        </PageContent>
      </PageLayout>
    );
  }

  const link = await loadEmployeeLink(Number(userId));
  if (!link.ok && link.status !== 404) {
    return (
      <PageLayout>
        <PageContent>
          <EmployeeAccessMessage
            title="Связь не загружена"
            message={link.message}
            href={employeesListHref()}
            linkLabel="К сотрудникам"
          />
        </PageContent>
      </PageLayout>
    );
  }
  const resolution = resolveUsersAlias({
    canAssign: true,
    userId,
    employeeId: link.ok ? link.data.employee_id : null,
    found: link.ok,
  });
  if (resolution.kind === "employee" || resolution.kind === "account") {
    redirect(resolution.href);
  }
  return (
    <PageLayout>
      <PageContent>
        <EmployeeAccessMessage
          title="Учётная запись не найдена"
          message="Такой учётки нет."
          href={employeesListHref()}
          linkLabel="К сотрудникам"
        />
      </PageContent>
    </PageLayout>
  );
}
