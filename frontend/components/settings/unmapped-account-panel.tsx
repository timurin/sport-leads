"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  linkAccountToEmployee,
  unlinkAccountFromEmployee,
} from "@/app/(workspace)/settings/users/employee-link-actions";
import { AccessMembershipEditor } from "@/components/settings/access-membership-editor";
import { EmployeeUserLinkPanel } from "@/components/settings/employee-user-link-panel";
import type {
  AccessRead,
  AccessRole,
  EffectiveAccess,
} from "@/app/(workspace)/settings/employees/access-actions";
import { employeeCardHref, employeesListHref } from "@/lib/settings/employee-access-routes";
import type { MappingAccount, MappingEmployee } from "@/lib/settings/employee-user-link";

export function UnmappedAccountPanel({
  account,
  accounts,
  employees,
  employeesError,
  roles,
  effective,
}: {
  account: MappingAccount;
  accounts: MappingAccount[];
  employees: MappingEmployee[];
  employeesError: string | null;
  roles: AccessRole[];
  effective: AccessRead<EffectiveAccess> | null;
}) {
  const router = useRouter();
  return (
    <div className="space-y-portal-4" data-unmapped-account={account.id}>
      <div>
        <p className="text-portal-caption text-portal-muted">Учётная запись без сотрудника</p>
        <h1 className="text-portal-section font-semibold text-portal-text">
          {account.displayName || account.login}
        </h1>
        <p className="text-portal-body text-portal-text">{account.login}</p>
      </div>
      <Link href={employeesListHref()} className="text-portal-caption font-semibold text-portal-primary hover:underline">
        К сотрудникам
      </Link>
      <EmployeeUserLinkPanel
        mode="account"
        employeeId={null}
        account={account}
        accounts={accounts}
        employees={employees}
        state="unlinked"
        statusMessage={null}
        pickerError={employeesError}
        onRefresh={() => router.refresh()}
        onLink={async (accountId, employeeId, reason) => {
          const result = await linkAccountToEmployee(accountId, employeeId, reason);
          if (result.ok) {
            router.replace(employeeCardHref(employeeId, "access"));
            return { ok: true };
          }
          return { ok: false, message: result.message, conflict: result.conflict };
        }}
        onUnlink={async (accountId, expectedEmployeeId, reason) => {
          const result = await unlinkAccountFromEmployee(accountId, expectedEmployeeId, reason);
          if (result.ok) {
            router.refresh();
            return { ok: true };
          }
          return { ok: false, message: result.message, conflict: result.conflict };
        }}
      />
      {effective?.ok ? (
        <AccessMembershipEditor
          employeeId={null}
          platformUserId={account.id}
          initial={effective.data}
          roles={roles}
        />
      ) : (
        <p className="text-portal-caption text-portal-muted">
          {effective?.message ?? "Группы не загружены."}
        </p>
      )}
    </div>
  );
}
