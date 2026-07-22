import { Suspense } from "react";

import { ProductModelsWorkspace } from "@/components/settings/product-models-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import {
  formatAssemblyVariantCostRange,
  getProductModelAssemblyVariants,
  getProductModels,
} from "@/lib/product-models";
import { getSizeGrids } from "@/lib/size-grids";

export default async function ProductModelsListPage() {
  const [models, sizeGrids] = await Promise.all([
    getProductModels(),
    getSizeGrids(),
  ]);

  const costEntries = await Promise.all(
    models.map(async (model) => {
      try {
        const variants = await getProductModelAssemblyVariants(model.id);
        return [model.id, formatAssemblyVariantCostRange(variants)] as const;
      } catch {
        return [model.id, "—"] as const;
      }
    }),
  );
  const costByModelId = Object.fromEntries(costEntries);

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="p-portal-6 text-portal-body text-portal-muted">
            Загрузка моделей…
          </div>
        }
      >
        <ProductModelsWorkspace
          models={models}
          sizeGrids={sizeGrids}
          costByModelId={costByModelId}
        />
      </Suspense>
    </PageLayout>
  );
}
