import { Suspense } from "react";

import { PageLayout } from "@/components/layout/page-layout";
import { ProductCharacteristicsWorkspace } from "@/components/settings/product-characteristics-workspace";
import {
  getCharacteristicDefinitions,
  getCharacteristicOptions,
} from "@/lib/nomenclature";

export default async function ProductCharacteristicsPage() {
  const definitions = await getCharacteristicDefinitions();
  const options = await Promise.all(
    definitions.map(
      async (definition) =>
        [
          definition.id,
          (await getCharacteristicOptions(definition.id)).length,
        ] as const,
    ),
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
          optionCounts={Object.fromEntries(options)}
        />
      </Suspense>
    </PageLayout>
  );
}
