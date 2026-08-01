/** Order-level discount helpers (`3.3.1`). */

/** Normalize UI percent input to API Decimal string, or null to clear. */
export function parseOrderDiscountPercentInput(
  raw: string,
): { ok: true; value: string | null } | { ok: false; message: string } {
  const normalized = String(raw ?? "")
    .trim()
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(",", ".");
  if (!normalized) {
    return { ok: true, value: null };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return { ok: false, message: "Укажите процент скидки числом от 0 до 100" };
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100) {
    return { ok: false, message: "Процент скидки заказа должен быть от 0 до 100" };
  }
  return { ok: true, value: amount.toFixed(2) };
}
