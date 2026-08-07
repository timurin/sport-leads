import { Suspense } from "react";

import { PageLayout } from "@/components/layout/page-layout";
import { ProductCharacteristicsWorkspace } from "@/components/settings/product-characteristics-workspace";
import { getCharacteristicDefinitions } from "@/lib/nomenclature";

export default async function ProductCharacteristicsPage() {
  const definitions = await getCharacteristicDefinitions();
  const optionCounts = Object.fromEntries(
    definitions.map((definition) => [
      definition.id,
      definition.option_count ?? 0,
    ]),
  );

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="p-portal-6 text-portal-body text-portal-muted">
            Загрузка характеристик…
          </div>
        }
      >
        <ProductCharacteristicsWorkspace
          definitions={definitions}
          optionCounts={optionCounts}
        />
      </Suspense>
    </PageLayout>
  );
}
