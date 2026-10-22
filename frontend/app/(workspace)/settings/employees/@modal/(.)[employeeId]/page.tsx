import { notFound } from "next/navigation";

import { EmployeeCardModal } from "@/components/settings/employee-card";
import { EmployeeAccessMessage } from "@/components/settings/employee-access-bodies";
import { EmployeeAccessLayer } from "@/components/settings/employee-access-layer";
import { loadEmployeeCard } from "@/app/(workspace)/settings/employees/employee-screen-data";
import { employeesListHref } from "@/lib/settings/employee-access-routes";

type Query = Record<string, string | string[] | undefined>;

export default async function EmployeeCardModalPage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<Query>;
}) {
  const { employeeId } = await params;
  const card = await loadEmployeeCard(employeeId, await searchParams);
  if (card.notFound) notFound();
  if (!card.employee) {
    return (
      <EmployeeAccessLayer title="Сотрудник">
        <EmployeeAccessMessage
          title="Не удалось загрузить сотрудника"
          message={card.message ?? "Сотрудник не загружен."}
          href={employeesListHref(card.filters)}
          linkLabel="К сотрудникам"
        />
      </EmployeeAccessLayer>
    );
  }
  return (
    <EmployeeCardModal
      employee={card.employee}
      organizations={card.organizations}
      tab={card.tab}
      filters={card.filters}
    />
  );
}
