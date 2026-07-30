/**
 * Stock balance read client for warehouse nomenclature list (`4.10.6` / `12.2.3`).
 * Wired to `GET /stock/balances` filled from posted ledger (`12.2.2`).
 * Dimension: warehouse × nomenclature; bins/lots out of MVP.
 */

export type StockBalanceRow = {
  nomenclature_id: number;
  quantity: number | string;
  /** Null/omitted when aggregated across warehouses. */
  warehouse_id?: number | null;
};

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

/** Map nomenclature_id → quantity string. Missing ids are treated as zero in UI. */
export async function getNomenclatureStockBalances(
  nomenclatureIds?: number[],
  options?: { warehouseId?: number },
): Promise<Record<number, string>> {
  const url = new URL(`${apiBaseUrl()}/stock/balances`);
  if (nomenclatureIds?.length) {
    for (const id of nomenclatureIds) {
      url.searchParams.append("nomenclature_id", String(id));
    }
  }
  if (options?.warehouseId != null) {
    url.searchParams.set("warehouse_id", String(options.warehouseId));
  }
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `Не удалось загрузить остатки номенклатуры (${response.status}).`,
    );
  }
  const rows = (await response.json()) as StockBalanceRow[];
  return Object.fromEntries(
    rows.map((row) => [row.nomenclature_id, String(row.quantity)]),
  );
}
