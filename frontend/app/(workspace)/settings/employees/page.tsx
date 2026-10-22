import { EmployeesWorkspace } from "@/components/settings/employees-workspace";
import { loadEmployeeDirectory } from "@/app/(workspace)/settings/employees/employee-screen-data";

type Query = Record<string, string | string[] | undefined>;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const data = await loadEmployeeDirectory(await searchParams);
  const accounts = data.directory?.ok
    ? data.directory.accounts.flatMap((account) =>
        account.employeeId == null
          ? []
          : [{
              employeeId: account.employeeId,
              login: account.login,
              active: account.active,
              inviteStatus: account.inviteStatus,
            }],
      )
    : null;
  const inviteRoles = data.catalog?.ok
    ? data.catalog.data.roles.map((role) => ({
        id: role.id,
        code: role.code,
        name: role.name,
        is_system: role.is_system,
        permissions: role.permissions,
      }))
    : null;
  const directoryError = data.directory && !data.directory.ok ? data.directory : null;
  return (
    <EmployeesWorkspace
      employees={data.employees.ok ? data.employees.items : []}
      organizations={data.organizations.ok ? data.organizations.items : []}
      loadError={data.employees.ok ? undefined : data.employees.message}
      filters={data.filters}
      accounts={accounts}
      accountsForbidden={!data.canAssign || directoryError?.status === 403}
      accountsMessage={directoryError?.message ?? null}
      inviteRoles={inviteRoles}
    />
  );
}
