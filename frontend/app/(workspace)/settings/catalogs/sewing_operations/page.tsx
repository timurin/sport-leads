import { Suspense } from "react";

import { SewingOperationsWorkspace } from "@/components/settings/sewing-operations-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import { getSewingOperations } from "@/lib/sewing-operations";
import { getWorkCenters } from "@/lib/shop-routings";

export default async function SewingOperationsListPage() {
  const [operations, sewingWorkCenters] = await Promise.all([
    getSewingOperations(),
    getWorkCenters({
      active_only: true,
      production_stage_code: "sewing",
      limit: 500,
    }),
  ]);

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="p-portal-6 text-portal-body text-portal-muted">
            Загрузка операций пошива…
          </div>
        }
      >
        <SewingOperationsWorkspace
          operations={operations}
          sewingWorkCenters={sewingWorkCenters}
        />
      </Suspense>
    </PageLayout>
  );
}
