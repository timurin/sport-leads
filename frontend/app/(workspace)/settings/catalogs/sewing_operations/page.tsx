import { Suspense } from "react";

import { SewingOperationsWorkspace } from "@/components/settings/sewing-operations-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import { retryBackendOnce } from "@/lib/backend-fetch";
import { getSewingOperationTemplates } from "@/lib/sewing-operation-templates";
import {
  getSewingOperationFolders,
  getSewingOperations,
} from "@/lib/sewing-operations";
import { getWorkCenters } from "@/lib/shop-routings";

export default async function SewingOperationsListPage() {
  const [operations, folders, sewingWorkCenters, templates] = await Promise.all([
    retryBackendOnce(() => getSewingOperations({ limit: 500 })),
    retryBackendOnce(() => getSewingOperationFolders()),
    retryBackendOnce(() =>
      getWorkCenters({
        active_only: true,
        production_stage_code: "sewing",
        limit: 500,
      }),
    ),
    retryBackendOnce(() => getSewingOperationTemplates()),
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
          folders={folders}
          sewingWorkCenters={sewingWorkCenters}
          templates={templates}
        />
      </Suspense>
    </PageLayout>
  );
}
