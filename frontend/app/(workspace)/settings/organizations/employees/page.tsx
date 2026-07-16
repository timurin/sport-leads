import { EntityWorkspace } from "@/components/entity/entity-workspace";
import { employeeRecords } from "@/lib/demo-data/catalogs";
import { employeesDefinition } from "@/lib/entity/definitions/employees";

export default function EmployeesPage() {
  return (
    <EntityWorkspace
      definition={employeesDefinition}
      records={employeeRecords}
    />
  );
}