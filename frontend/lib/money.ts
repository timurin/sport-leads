/**
 * Platform money / currency display (`DS-MONEY-01`).
 *
 * Storage and API keep ISO 4217 codes (`RUB`, `USD`, …).
 * UI never shows the literal `RUB` — always the ruble sign `₽`.
 */

export const PLATFORM_DEFAULT_CURRENCY = "RUB";

/** ISO codes used in catalog selects; values stay ISO for API. */
export const PLATFORM_CURRENCY_CODES = ["RUB", "USD", "EUR"] as const;

export type PlatformCurrencyCode = (typeof PLATFORM_CURRENCY_CODES)[number];

const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: "₽",
  USD: "$",
  EUR: "€",
};

/** Normalize ISO code; empty → platform default. */
export function normalizeCurrencyCode(
  code: string | null | undefined,
): string {
  const normalized = (code ?? "").trim().toUpperCase();
  return normalized || PLATFORM_DEFAULT_CURRENCY;
}

/**
 * Display symbol for an ISO currency code.
 * `RUB` → `₽` (platform rule). Unknown codes fall back to the ISO string.
 */
export function currencySymbol(code: string | null | undefined): string {
  const normalized = normalizeCurrencyCode(code);
  return CURRENCY_SYMBOLS[normalized] ?? normalized;
}

/** Label for selects: symbol first; ISO only when it differs from the symbol. */
export function currencyOptionLabel(code: string): string {
  const symbol = currencySymbol(code);
  const normalized = normalizeCurrencyCode(code);
  return symbol === normalized ? normalized : symbol;
}

/** `amount` + currency symbol for list/card readouts. */
export function formatAmountWithCurrency(
  amount: string | number,
  code?: string | null,
): string {
  return `${amount} ${currencySymbol(code)}`;
}
