"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  linkAccountToEmployee,
  loadAccountDirectory,
  unlinkAccountFromEmployee,
} from "@/app/(workspace)/settings/users/employee-link-actions";
import { EffectiveAccessSummary } from "@/components/settings/effective-access-summary";
import { EmployeeUserLinkPanel } from "@/components/settings/employee-user-link-panel";
import {
  employeeAccessView,
  type DirectoryRead,
} from "@/lib/settings/employee-user-link";
import {
  accessGroupsHref,
  accessMatrixHref,
  type EmployeeListFilters,
} from "@/lib/settings/employee-access-routes";

export function EmployeeAccessSection({
  employeeId,
  filters = {},
}: {
  employeeId: number;
  filters?: EmployeeListFilters;
}) {
  const router = useRouter();
  const [read, setRead] = useState<DirectoryRead | null>(null);

  const reload = useCallback(async () => {
    const next = await loadAccountDirectory();
    setRead(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await loadAccountDirectory();
      if (!cancelled) setRead(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  const view = read == null ? null : employeeAccessView(read, employeeId);
  const accounts = read?.ok ? read.accounts : [];
  const account = view?.state === "linked" ? view.account : null;

  const canManage = view != null && view.state !== "forbidden" && view.state !== "unavailable";

  return (
    <div className="space-y-portal-3">
      <EmployeeUserLinkPanel
        mode="employee"
        employeeId={employeeId}
        account={account}
        accounts={accounts}
        employees={[]}
        state={view?.state ?? "loading"}
        statusMessage={view && "message" in view ? view.message : null}
        onRefresh={() => {
          void reload();
        }}
        onLink={async (accountId, nextEmployeeId, reason) => {
          const result = await linkAccountToEmployee(accountId, nextEmployeeId, reason);
          if (result.ok) {
            await reload();
            router.refresh();
            return { ok: true };
          }
          return { ok: false, message: result.message, conflict: result.conflict };
        }}
        onUnlink={async (accountId, expectedEmployeeId, reason) => {
          const result = await unlinkAccountFromEmployee(accountId, expectedEmployeeId, reason);
          if (result.ok) {
            await reload();
            router.refresh();
            return { ok: true };
          }
          return { ok: false, message: result.message, conflict: result.conflict };
        }}
      />
      {account ? <EffectiveAccessSummary platformUserId={account.id} /> : null}
      {canManage ? (
        <div className="flex flex-wrap gap-portal-3 text-portal-caption">
          {account ? (
            <Link href={accessMatrixHref(employeeId, filters)} className="font-semibold text-portal-primary hover:underline">
              Назначить группы
            </Link>
          ) : null}
          <Link href={accessGroupsHref(employeeId, filters)} className="font-semibold text-portal-primary hover:underline">
            Группы доступа
          </Link>
        </div>
      ) : null}
    </div>
  );
}
