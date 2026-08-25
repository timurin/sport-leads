import { EmployeesWorkspace } from "@/components/settings/employees-workspace";
import { getEmployeesList } from "@/lib/settings/employees-api";
import { getOrganizationsList } from "@/lib/settings/organizations-api";

export default async function EmployeesPage() {
  const [employees, organizations] = await Promise.all([
    getEmployeesList(false),
    getOrganizationsList(false),
  ]);
  return (
    <EmployeesWorkspace
      employees={employees.ok ? employees.items : []}
      organizations={organizations.ok ? organizations.items : []}
      loadError={employees.ok ? undefined : employees.message}
    />
  );
}
