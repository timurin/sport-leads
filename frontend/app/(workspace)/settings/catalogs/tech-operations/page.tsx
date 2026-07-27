import { Suspense } from "react";

import { TechOperationsWorkspace } from "@/components/settings/tech-operations-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import { getProductionStages } from "@/lib/production-stages";
import { getTechOperations } from "@/lib/tech-operations";

export default async function TechOperationsListPage() {
  const [operations, productionStages] = await Promise.all([
    getTechOperations(),
    getProductionStages({ active_only: true, limit: 500 }),
  ]);

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="p-portal-6 text-portal-body text-portal-muted">
            Загрузка технологических операций…
          </div>
        }
      >
        <TechOperationsWorkspace
          operations={operations}
          productionStages={productionStages}
        />
      </Suspense>
    </PageLayout>
  );
}
