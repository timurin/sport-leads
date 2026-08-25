import Link from "next/link";
import { notFound } from "next/navigation";

import { EmployeeCard } from "@/components/settings/employee-card";
import { PageContent, PageLayout } from "@/components/layout/page-layout";
import { getEmployeeDetail } from "@/lib/settings/employees-api";
import { getOrganizationsList } from "@/lib/settings/organizations-api";

type Props = {
  params: Promise<{ employeeId: string }>;
};

export default async function EmployeePage({ params }: Props) {
  const { employeeId } = await params;
  const [result, organizations] = await Promise.all([
    getEmployeeDetail(employeeId),
    getOrganizationsList(false),
  ]);
  if (!result.ok && result.notFound) {
    notFound();
  }
  if (!result.ok || result.employee === null) {
    return (
      <PageLayout>
        <PageContent size="spacious">
          <section className="rounded-portal-lg border border-portal-border bg-portal-surface p-portal-6">
            <h1 className="text-portal-page font-semibold text-portal-text">
              Не удалось загрузить сотрудника
            </h1>
            <p className="mt-portal-2 text-portal-body text-portal-muted">{result.message}</p>
            <p className="mt-portal-4">
              <Link
                href="/settings/organizations/employees"
                className="font-semibold text-portal-primary hover:underline"
              >
                К списку сотрудников
              </Link>
            </p>
          </section>
        </PageContent>
      </PageLayout>
    );
  }
  return (
    <EmployeeCard
      employee={result.employee}
      organizations={organizations.ok ? organizations.items : []}
    />
  );
}
