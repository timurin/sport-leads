import {
  EmployeeAccessFrame,
  GroupIndexBody,
} from "@/components/settings/employee-access-bodies";
import { loadGroupScreen } from "@/app/(workspace)/settings/employees/employee-screen-data";

type Query = Record<string, string | string[] | undefined>;

export default async function AccessGroupsPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const screen = await loadGroupScreen("new", await searchParams);
  return (
    <EmployeeAccessFrame>
      <GroupIndexBody
        roles={screen.catalog.ok ? screen.catalog.data.roles : []}
        error={screen.catalog.ok ? null : screen.catalog.message}
        employee={screen.employee}
        filters={screen.filters}
      />
    </EmployeeAccessFrame>
  );
}
