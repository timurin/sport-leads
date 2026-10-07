import { Suspense } from "react";

import { TechOperationsWorkspace } from "@/components/settings/tech-operations-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import { getCapacityResources } from "@/lib/capacity-resources";
import { getNomenclature } from "@/lib/nomenclature";
import { getProductionStages } from "@/lib/production-stages";
import { getWorkCenters } from "@/lib/shop-routings";
import { getTechOperations } from "@/lib/tech-operations";

export default async function TechOperationsListPage() {
  const [operations, productionStages, nomenclature, resources, workCenters] = await Promise.all([
    getTechOperations(),
    getProductionStages({ active_only: true, limit: 500 }),
    getNomenclature(),
    getCapacityResources(),
    getWorkCenters({ active_only: true, limit: 500 }),
  ]);
  const materialOptions = nomenclature.filter(
    (row) => row.nomenclature_type === "MATERIAL" && row.is_active,
  );

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
          workCenters={workCenters}
          resources={resources}
          materialOptions={materialOptions}
        />
      </Suspense>
    </PageLayout>
  );
}
