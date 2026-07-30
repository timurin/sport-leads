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
        const media = await getNomenclatureMedia(item.id);
        const contentUrl = primaryNomenclatureCoverContentUrl(media);
        return [
          item.id,
          contentUrl ? nomenclatureMediaUrl(contentUrl) : null,
        ] as const;
      }),
    ),
    Promise.all(
      items.map(
        async (item) =>
          [
            item.id,
            await getNomenclatureCharacteristicValues(item.id),
          ] as const,
      ),
    ),
    getNomenclatureStockBalances(items.map((item) => item.id)),
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
