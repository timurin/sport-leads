export type VatRate = {
  id: number;
  name: string;
  rate_percent: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

function toNumber(value: string | number): number {
  return typeof value === "number" ? value : Number(String(value).replace(",", "."));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatVatRatePercent(value: string | number): string {
  const amount = toNumber(value);
  if (!Number.isFinite(amount)) return "0%";
  const normalized = Number.isInteger(amount)
    ? String(amount)
    : amount.toFixed(2).replace(/\.?0+$/, "");
  return `${normalized}%`;
}

export function vatRateLabel(rate: Pick<VatRate, "name" | "rate_percent">): string {
  return rate.name || formatVatRatePercent(rate.rate_percent);
}

/**
 * НДС сверху (цена без налога).
 * vat = net × (rate / 100)
 * gross = net × (1 + rate / 100)
 */
export function calculateExclusiveVatAmount(
  amountWithoutVat: number,
  ratePercent: number,
): number {
  if (!Number.isFinite(amountWithoutVat) || amountWithoutVat <= 0) return 0;
  if (!Number.isFinite(ratePercent) || ratePercent <= 0) return 0;
  return roundMoney((amountWithoutVat * ratePercent) / 100);
}

export function calculateAmountWithVat(
  amountWithoutVat: number,
  ratePercent: number,
): number {
  if (!Number.isFinite(amountWithoutVat) || amountWithoutVat <= 0) return 0;
  if (!Number.isFinite(ratePercent) || ratePercent <= 0) {
    return roundMoney(amountWithoutVat);
  }
  return roundMoney(amountWithoutVat * (1 + ratePercent / 100));
}

/**
 * НДС в сумме / цене (выделение).
 * vat = gross × [rate / (100 + rate)]
 * net = gross − vat
 */
export function calculateInclusiveVatAmount(
  amountWithVat: number,
  ratePercent: number,
): number {
  if (!Number.isFinite(amountWithVat) || amountWithVat <= 0) return 0;
  if (!Number.isFinite(ratePercent) || ratePercent <= 0) return 0;
  return roundMoney((amountWithVat * ratePercent) / (100 + ratePercent));
}

export function calculateAmountWithoutVat(
  amountWithVat: number,
  ratePercent: number,
): number {
  if (!Number.isFinite(amountWithVat) || amountWithVat <= 0) return 0;
  if (!Number.isFinite(ratePercent) || ratePercent <= 0) {
    return roundMoney(amountWithVat);
  }
  return roundMoney(amountWithVat - calculateInclusiveVatAmount(amountWithVat, ratePercent));
}

/** Line VAT by mode: inclusive (в сумме) or exclusive (сверху). */
export function calculateLineVatAmount(
  lineAmount: number,
  ratePercent: number,
  priceIncludesVat: boolean,
): number {
  if (priceIncludesVat) {
    return calculateInclusiveVatAmount(lineAmount, ratePercent);
  }
  return calculateExclusiveVatAmount(lineAmount, ratePercent);
}

/** Line total with VAT for document contribution. */
export function calculateLineGrossAmount(
  lineAmount: number,
  ratePercent: number,
  priceIncludesVat: boolean,
): number {
  if (priceIncludesVat) {
    return roundMoney(lineAmount);
  }
  return roundMoney(lineAmount + calculateExclusiveVatAmount(lineAmount, ratePercent));
}

export async function getVatRates(params?: {
  is_active?: boolean;
}): Promise<VatRate[]> {
  const query = new URLSearchParams();
  if (params?.is_active !== undefined) {
    query.set("is_active", String(params.is_active));
  }
  query.set("limit", "500");
  const suffix = query.toString() ? `?${query}` : "";
  const response = await fetch(`${apiBaseUrl()}/vat-rates${suffix}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить ставки НДС (${response.status}).`);
  }
  return (await response.json()) as VatRate[];
}
