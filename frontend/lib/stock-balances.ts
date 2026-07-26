/**
 * Stock balance read client for warehouse nomenclature list (`4.10.6`).
 * Wired to `GET /stock/balances` — empty until register posts (ADR-012).
 */

export type StockBalanceRow = {
  nomenclature_id: number;
  quantity: number | string;
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
): Promise<Record<number, string>> {
  const url = new URL(`${apiBaseUrl()}/stock/balances`);
  if (nomenclatureIds?.length) {
    for (const id of nomenclatureIds) {
      url.searchParams.append("nomenclature_id", String(id));
    }
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
