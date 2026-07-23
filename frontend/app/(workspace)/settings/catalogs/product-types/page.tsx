import { Suspense } from "react";

import { ProductTypesWorkspace } from "@/components/settings/product-types-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import { getProductTypes } from "@/lib/product-types";

export default async function ProductTypesListPage() {
  const productTypes = await getProductTypes();

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="p-portal-6 text-portal-body text-portal-muted">
            Загрузка типов изделий…
          </div>
        }
      >
        <ProductTypesWorkspace productTypes={productTypes} />
      </Suspense>
    </PageLayout>
  );
}
