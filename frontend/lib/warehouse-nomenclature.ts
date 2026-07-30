import {
  getNomenclature,
  getNomenclatureCategories,
  getNomenclatureCharacteristicValues,
  getNomenclatureMedia,
  getUnitsOfMeasure,
  nomenclatureMediaUrl,
  type Nomenclature,
  type NomenclatureCategory,
  type NomenclatureCharacteristicValue,
  type UnitOfMeasure,
} from "@/lib/nomenclature";
import { getNomenclatureStockBalances } from "@/lib/stock-balances";
import { primaryNomenclatureCoverContentUrl } from "@/lib/warehouse-nomenclature-covers";

export type WarehouseNomenclatureCatalog = {
  items: Nomenclature[];
  categories: NomenclatureCategory[];
  units: UnitOfMeasure[];
  coverUrls: Record<number, string | null>;
  fieldValues: Record<number, NomenclatureCharacteristicValue[]>;
  /** Live projected balances from posted ledger via `/stock/balances` (`12.2.3`). */
  stockBalances: Record<number, string>;
};

export { primaryNomenclatureCoverContentUrl };

/**
 * Catalog payload for `/warehouse/stock` (`4.10.2`–`4.10.6`, live remainder `12.2.3`).
 * Media/characteristic failures do not fail the whole page (covers stay empty).
 */
export async function loadWarehouseNomenclatureCatalog(): Promise<WarehouseNomenclatureCatalog> {
  const [items, categories, units] = await Promise.all([
    getNomenclature(),
    getNomenclatureCategories(),
    getUnitsOfMeasure(),
  ]);
  const [coverEntries, valuesEntries, stockBalances] = await Promise.all([
    Promise.all(
      items.map(async (item) => {
        try {
          const media = await getNomenclatureMedia(item.id);
          const contentUrl = primaryNomenclatureCoverContentUrl(media);
          return [
            item.id,
            contentUrl ? nomenclatureMediaUrl(contentUrl) : null,
          ] as const;
        } catch {
          return [item.id, null] as const;
        }
      }),
    ),
    Promise.all(
      items.map(async (item) => {
        try {
          return [
            item.id,
            await getNomenclatureCharacteristicValues(item.id),
          ] as const;
        } catch {
          return [item.id, []] as const;
        }
      }),
    ),
    getNomenclatureStockBalances(items.map((item) => item.id)).catch(
      () => ({}) as Record<number, string>,
    ),
  ]);
  return {
    items,
    categories,
    units,
    coverUrls: Object.fromEntries(coverEntries),
    fieldValues: Object.fromEntries(valuesEntries),
    stockBalances,
  };
}
