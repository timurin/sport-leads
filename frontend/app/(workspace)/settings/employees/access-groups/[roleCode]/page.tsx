import {
  EmployeeAccessFrame,
  GroupBody,
} from "@/components/settings/employee-access-bodies";
import { loadGroupScreen } from "@/app/(workspace)/settings/employees/employee-screen-data";

type Query = Record<string, string | string[] | undefined>;

export default async function AccessGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ roleCode: string }>;
  searchParams: Promise<Query>;
}) {
  const { roleCode } = await params;
  const screen = await loadGroupScreen(decodeURIComponent(roleCode), await searchParams);
  return (
    <EmployeeAccessFrame>
      <GroupBody screen={screen} />
    </EmployeeAccessFrame>
  );
}
