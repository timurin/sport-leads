import { Suspense } from "react";

import { PageLayout } from "@/components/layout/page-layout";
import { ProductionStagesWorkspace } from "@/components/settings/production-stages-workspace";
import { getProductionStages } from "@/lib/production-stages";

export default async function ProductionStagesPage() {
  const stages = await getProductionStages();
  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<div className="p-portal-6 text-portal-body text-portal-muted">Загрузка цехов…</div>}>
        <ProductionStagesWorkspace stages={stages} />
      </Suspense>
    </PageLayout>
  );
}
