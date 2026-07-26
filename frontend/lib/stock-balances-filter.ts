/**
 * Pure stock-balance helpers for warehouse list (`4.10.6`).
 * Missing API rows → treat as zero; never invent demo quantities.
 */

export type StockPresenceFilter = "all" | "in_stock";

export function stockBalanceOrZero(
  balances: Record<number, string>,
  nomenclatureId: number,
): string {
  const raw = balances[nomenclatureId];
  if (raw == null || String(raw).trim() === "") {
    return "0";
  }
  return String(raw);
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
