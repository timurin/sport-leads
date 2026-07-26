import { Suspense } from "react";

import { TechOperationsWorkspace } from "@/components/settings/tech-operations-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import { getTechOperations } from "@/lib/tech-operations";

export default async function TechOperationsListPage() {
  const operations = await getTechOperations();

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="p-portal-6 text-portal-body text-portal-muted">
            Загрузка технологических операций…
          </div>
        }
      >
        <TechOperationsWorkspace operations={operations} />
      </Suspense>
    </PageLayout>
  );
}
