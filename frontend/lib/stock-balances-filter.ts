/**
 * Pure stock-balance helpers for warehouse list (`4.10.6` / `12.2.3`).
 * Values come from posted ledger via `GET /stock/balances`.
 * Missing API rows → treat as zero; never invent demo quantities (ADR-012).
 */

export type StockPresenceFilter = "all" | "in_stock";

/** Normalize ledger qty for list display (strip trailing zeros, max 3 dp). */
export function formatStockBalanceQty(raw: string | number | null | undefined): string {
  if (raw == null || String(raw).trim() === "") {
    return "0";
  }
  const value = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(value)) {
    return "0";
  }
  return String(parseFloat(value.toFixed(3)));
}

export function stockBalanceOrZero(
  balances: Record<number, string>,
  nomenclatureId: number,
): string {
  return formatStockBalanceQty(balances[nomenclatureId]);
}

export function hasPositiveStockBalance(quantity: string): boolean {
  const value = Number(quantity);
  return Number.isFinite(value) && value > 0;
}

export function filterByStockPresence<T extends { id: number }>(
  items: T[],
  balances: Record<number, string>,
  filter: StockPresenceFilter,
): T[] {
  if (filter === "all") {
    return items;
  }
  return items.filter((item) =>
    hasPositiveStockBalance(stockBalanceOrZero(balances, item.id)),
  );
}
