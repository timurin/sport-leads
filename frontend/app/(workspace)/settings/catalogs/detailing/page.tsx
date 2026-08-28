import { Suspense } from "react";

import { DetailingWorkspace } from "@/components/settings/detailing-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import { getDetailingItems } from "@/lib/detailing";
import { getProductTypes } from "@/lib/product-types";

export default async function DetailingCatalogPage() {
  const [items, productTypes] = await Promise.all([
    getDetailingItems({ limit: 500 }),
    getProductTypes({ limit: 500 }),
  ]);

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="p-portal-6 text-portal-body text-portal-muted">
            Загрузка деталировки…
          </div>
        }
      >
        <DetailingWorkspace items={items} productTypes={productTypes} />
      </Suspense>
    </PageLayout>
  );
}
