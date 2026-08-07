import {
  getNomenclature,
  getNomenclatureCategories,
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

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

type NomenclatureListExtrasResponse = {
  covers: Record<string, string | null>;
  values: Record<string, NomenclatureCharacteristicValue[]>;
};

async function getNomenclatureListExtras(
  nomenclatureIds: number[],
): Promise<{
  covers: Record<number, string | null>;
  values: Record<number, NomenclatureCharacteristicValue[]>;
}> {
  if (nomenclatureIds.length === 0) {
    return { covers: {}, values: {} };
  }
  const url = new URL(`${apiBaseUrl()}/nomenclatures/list-extras`);
  for (const id of nomenclatureIds) {
    url.searchParams.append("nomenclature_id", String(id));
  }
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `Не удалось загрузить covers/values номенклатуры (${response.status}).`,
    );
  }
  const payload = (await response.json()) as NomenclatureListExtrasResponse;
  const covers: Record<number, string | null> = {};
  const values: Record<number, NomenclatureCharacteristicValue[]> = {};
  for (const [key, value] of Object.entries(payload.covers ?? {})) {
    covers[Number(key)] = value;
  }
  for (const [key, rows] of Object.entries(payload.values ?? {})) {
    values[Number(key)] = rows;
  }
  return { covers, values };
}

/**
 * Catalog payload for `/warehouse/stock` (`4.10.2`–`4.10.6`, live remainder `12.2.3`).
 * Covers/values loaded via one batch `GET /nomenclatures/list-extras` (`0.2.3.2`).
 */
export async function loadWarehouseNomenclatureCatalog(): Promise<WarehouseNomenclatureCatalog> {
  const [items, categories, units] = await Promise.all([
    getNomenclature(),
    getNomenclatureCategories(),
    getUnitsOfMeasure(),
  ]);
  const ids = items.map((item) => item.id);
  const [extras, stockBalances] = await Promise.all([
    getNomenclatureListExtras(ids).catch(() => ({
      covers: {} as Record<number, string | null>,
      values: {} as Record<number, NomenclatureCharacteristicValue[]>,
    })),
    getNomenclatureStockBalances(ids).catch(
      () => ({}) as Record<number, string>,
    ),
  ]);
  const coverUrls: Record<number, string | null> = {};
  for (const [id, url] of Object.entries(extras.covers)) {
    coverUrls[Number(id)] = url ? nomenclatureMediaUrl(url) : null;
  }
  return {
    items,
    categories,
    units,
    coverUrls,
    fieldValues: extras.values,
    stockBalances,
  };
}
