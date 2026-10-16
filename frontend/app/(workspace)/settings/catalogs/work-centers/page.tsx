import { Suspense } from "react";

import { WorkCentersWorkspace } from "@/components/settings/work-centers-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import { getProductionStages } from "@/lib/production-stages";
import { getWorkCenters } from "@/lib/shop-routings";
import { parseEquipmentCapacityId } from "@/lib/tech-operation-ux";

export default async function WorkCentersListPage({
  searchParams,
}: {
  searchParams: Promise<{ capacity?: string }>;
}) {
  const query = await searchParams;
  const [workCenters, productionStages] = await Promise.all([
    getWorkCenters({ limit: 500 }),
    getProductionStages({ active_only: false, limit: 500 }),
  ]);

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="p-portal-6 text-portal-body text-portal-muted">
            Загрузка оборудования…
          </div>
        }
      >
        <WorkCentersWorkspace
          workCenters={workCenters}
          productionStages={productionStages}
          initialCapacityId={parseEquipmentCapacityId(query.capacity)}
        />
      </Suspense>
    </PageLayout>
  );
}
