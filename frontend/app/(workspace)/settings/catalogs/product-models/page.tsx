import { Suspense } from "react";

import { ProductModelsWorkspace } from "@/components/settings/product-models-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import {
  formatAssemblyCostBounds,
  getProductModelFolders,
  getProductModels,
} from "@/lib/product-models";
import { getProductTypes } from "@/lib/product-types";
import { getSewingOperationTemplates } from "@/lib/sewing-operation-templates";
import { getSizeGrids } from "@/lib/size-grids";

export default async function ProductModelsListPage() {
  const [models, folders, sizeGrids, productTypes, sewingTemplates] =
    await Promise.all([
      getProductModels({ limit: 500 }),
      getProductModelFolders(),
      getSizeGrids(),
      getProductTypes(),
      getSewingOperationTemplates(),
    ]);

  const costByModelId = Object.fromEntries(
    models.map((model) => [
      model.id,
      formatAssemblyCostBounds(
        model.assembly_cost_min,
        model.assembly_cost_max,
      ),
    ]),
  );

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
          folders={folders}
          sizeGrids={sizeGrids}
          productTypes={productTypes}
          sewingTemplates={sewingTemplates}
          costByModelId={costByModelId}
        />
      </Suspense>
    </PageLayout>
  );
}
