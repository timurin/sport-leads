import { EmployeeAccessLayer } from "@/components/settings/employee-access-layer";
import { GroupBody } from "@/components/settings/employee-access-bodies";
import { loadGroupScreen } from "@/app/(workspace)/settings/employees/employee-screen-data";

type Query = Record<string, string | string[] | undefined>;

export default async function AccessGroupModalPage({
  params,
  searchParams,
}: {
  params: Promise<{ roleCode: string }>;
  searchParams: Promise<Query>;
}) {
  const { roleCode } = await params;
  const screen = await loadGroupScreen(decodeURIComponent(roleCode), await searchParams);
  const title = screen.creating
    ? "Новая группа"
    : screen.role?.ok
      ? screen.role.data.name
      : "Группа доступа";
  return (
    <EmployeeAccessLayer title={title} employee={screen.employee} filters={screen.filters}>
      <GroupBody screen={screen} />
    </EmployeeAccessLayer>
  );
}
