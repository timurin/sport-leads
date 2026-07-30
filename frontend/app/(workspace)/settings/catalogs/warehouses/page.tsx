import { Suspense } from "react";

import { WarehousesWorkspace } from "@/components/settings/warehouses-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import { getWarehouses } from "@/lib/warehouses";

export default async function WarehousesListPage() {
  const warehouses = await getWarehouses({ limit: 500 });

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="p-portal-6 text-portal-body text-portal-muted">
            Загрузка складов…
          </div>
        }
      >
        <WarehousesWorkspace warehouses={warehouses} />
      </Suspense>
    </PageLayout>
  );
}
