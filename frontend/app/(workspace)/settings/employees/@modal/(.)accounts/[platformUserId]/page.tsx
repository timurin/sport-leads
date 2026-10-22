import { notFound, redirect } from "next/navigation";

import { EmployeeAccessLayer } from "@/components/settings/employee-access-layer";
import { AccountBody } from "@/components/settings/employee-access-bodies";
import { loadAccountScreen } from "@/app/(workspace)/settings/employees/employee-screen-data";
import { employeeCardHref } from "@/lib/settings/employee-access-routes";

export default async function UnmappedAccountModalPage({
  params,
}: {
  params: Promise<{ platformUserId: string }>;
}) {
  const { platformUserId } = await params;
  const screen = await loadAccountScreen(platformUserId);
  if (screen.id == null) notFound();
  if (screen.account?.employeeId) {
    redirect(employeeCardHref(screen.account.employeeId, "access"));
  }
  const message = screen.directory && !screen.directory.ok
    ? screen.directory.message
    : screen.account
      ? null
      : "Учётная запись не найдена.";
  return (
    <EmployeeAccessLayer title={screen.account?.login ?? "Учётная запись"}>
      <AccountBody
        account={screen.account}
        accounts={screen.directory?.ok ? screen.directory.accounts : []}
        employees={
          screen.employees?.ok
            ? screen.employees.items.map((item) => ({
                id: item.id,
                fullName: item.fullName,
                isActive: item.isActive,
              }))
            : []
        }
        employeesError={screen.employees && !screen.employees.ok ? screen.employees.message : null}
        roles={screen.catalog?.ok ? screen.catalog.data.roles : []}
        effective={screen.effective}
        message={message}
      />
    </EmployeeAccessLayer>
  );
}
