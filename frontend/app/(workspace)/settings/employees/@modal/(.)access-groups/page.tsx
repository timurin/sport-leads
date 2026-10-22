import { EmployeeAccessLayer } from "@/components/settings/employee-access-layer";
import { GroupIndexBody } from "@/components/settings/employee-access-bodies";
import { loadGroupScreen } from "@/app/(workspace)/settings/employees/employee-screen-data";

type Query = Record<string, string | string[] | undefined>;

export default async function AccessGroupsModalPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const screen = await loadGroupScreen("new", await searchParams);
  return (
    <EmployeeAccessLayer
      title="Группы доступа"
      employee={screen.employee}
      filters={screen.filters}
    >
      <GroupIndexBody
        roles={screen.catalog.ok ? screen.catalog.data.roles : []}
        error={screen.catalog.ok ? null : screen.catalog.message}
        employee={screen.employee}
        filters={screen.filters}
      />
    </EmployeeAccessLayer>
  );
}
