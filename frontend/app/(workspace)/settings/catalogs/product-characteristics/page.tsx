import { Suspense } from "react";

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
    <Suspense
      fallback={
        <div className="p-6 text-sm text-slate-500">
          Загрузка характеристик…
        </div>
      }
    >
      <ProductCharacteristicsWorkspace
        definitions={definitions}
        optionCounts={Object.fromEntries(options)}
      />
    </Suspense>
  );
}
