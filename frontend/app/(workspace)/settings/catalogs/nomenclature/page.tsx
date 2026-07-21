import { Suspense } from "react";

import { NomenclatureWorkspace } from "@/components/settings/nomenclature-workspace";
import {
  getNomenclature,
  getNomenclatureCategories,
  getNomenclatureFieldValues,
  getUnitsOfMeasure,
} from "@/lib/nomenclature";

export default async function NomenclaturePage() {
  const [items, categories, units] = await Promise.all([
    getNomenclature(),
    getNomenclatureCategories(),
    getUnitsOfMeasure(),
  ]);
  const values = Object.fromEntries(
    await Promise.all(
      items.map(
        async (item) =>
          [item.id, await getNomenclatureFieldValues(item.id)] as const,
      ),
    ),
  );

  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-slate-500">Загрузка номенклатуры…</div>
      }
    >
      <NomenclatureWorkspace
        items={items}
        categories={categories}
        units={units}
        fieldValues={values}
      />
    </Suspense>
  );
}
