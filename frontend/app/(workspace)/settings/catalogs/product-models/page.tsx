import { Suspense } from "react";

import { ProductModelsWorkspace } from "@/components/settings/product-models-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import { getProductModels } from "@/lib/product-models";

export default async function ProductModelsListPage() {
  const models = await getProductModels();

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="p-portal-6 text-portal-body text-portal-muted">
            Загрузка моделей…
          </div>
        }
      >
        <ProductModelsWorkspace models={models} />
      </Suspense>
    </PageLayout>
  );
}
