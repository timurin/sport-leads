import { redirect } from "next/navigation";

import {
  employeesListHref,
  normalizeEmployeeFilters,
} from "@/lib/settings/employee-access-routes";

export default async function LegacyEmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(employeesListHref(normalizeEmployeeFilters(await searchParams)));
}
