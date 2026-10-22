import { notFound, redirect } from "next/navigation";

import { legacyEmployeeTarget } from "@/lib/settings/employee-access-routes";

export default async function LegacyEmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { employeeId } = await params;
  const target = legacyEmployeeTarget(employeeId, await searchParams);
  if (!target) notFound();
  redirect(target);
}
