import { Suspense } from "react";

import { NomenclatureWorkspace } from "@/components/settings/nomenclature-workspace";
import {
  getNomenclature,
  getNomenclatureCategories,
  getNomenclatureFieldValues,
  getNomenclatureMedia,
  getUnitsOfMeasure,
  nomenclatureMediaUrl,
} from "@/lib/nomenclature";

export default async function NomenclaturePage() {
  const [items, categories, units] = await Promise.all([
    getNomenclature(),
    getNomenclatureCategories(),
    getUnitsOfMeasure(),
  ]);
  const [valuesEntries, coverEntries] = await Promise.all([
    Promise.all(
      items.map(
        async (item) =>
          [item.id, await getNomenclatureFieldValues(item.id)] as const,
      ),
    ),
    Promise.all(
      items.map(async (item) => {
        const media = await getNomenclatureMedia(item.id);
        const primary =
          media.find((row) => row.is_primary) ?? media[0] ?? null;
        return [
          item.id,
          primary?.content_url
            ? nomenclatureMediaUrl(primary.content_url)
            : null,
        ] as const;
      }),
    ),
  ]);
  const values = Object.fromEntries(valuesEntries);
  const coverUrls = Object.fromEntries(coverEntries);

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
        coverUrls={coverUrls}
      />
    </Suspense>
  );
}
