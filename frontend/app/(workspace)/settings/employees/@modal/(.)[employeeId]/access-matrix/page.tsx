import { notFound } from "next/navigation";

import { EmployeeAccessLayer } from "@/components/settings/employee-access-layer";
import { EmployeeAccessMessage, MatrixBody } from "@/components/settings/employee-access-bodies";
import { loadMatrixScreen } from "@/app/(workspace)/settings/employees/employee-screen-data";
import { employeesListHref } from "@/lib/settings/employee-access-routes";

type Query = Record<string, string | string[] | undefined>;

export default async function EmployeeMatrixModalPage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<Query>;
}) {
  const { employeeId } = await params;
  const screen = await loadMatrixScreen(employeeId, await searchParams);
  if (screen.card.notFound) notFound();
  if (!screen.card.employee) {
    return (
      <EmployeeAccessLayer title="Группы доступа">
        <EmployeeAccessMessage
          title="Не удалось загрузить сотрудника"
          message={screen.card.message ?? "Сотрудник не загружен."}
          href={employeesListHref(screen.card.filters)}
          linkLabel="К сотрудникам"
        />
      </EmployeeAccessLayer>
    );
  }
  return (
    <EmployeeAccessLayer
      title={`Группы: ${screen.card.employee.fullName}`}
      employee={screen.card.employee}
      organizations={screen.card.organizations}
      filters={screen.card.filters}
    >
      <MatrixBody
        employee={screen.card.employee}
        filters={screen.card.filters}
        directoryMessage={screen.directoryMessage}
        catalog={screen.catalog}
        account={screen.account}
        effective={screen.effective}
      />
    </EmployeeAccessLayer>
  );
}
