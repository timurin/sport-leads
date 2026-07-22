import { Suspense } from "react";

import { SewingOperationsWorkspace } from "@/components/settings/sewing-operations-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import { getSewingOperations } from "@/lib/sewing-operations";

export default async function SewingOperationsListPage() {
  const operations = await getSewingOperations();

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="p-portal-6 text-portal-body text-portal-muted">
            Загрузка операций пошива…
          </div>
        }
      >
        <SewingOperationsWorkspace operations={operations} />
      </Suspense>
    </PageLayout>
  );
}
