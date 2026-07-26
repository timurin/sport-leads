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

export function formatVatRatePercent(value: string | number): string {
  const amount =
    typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(amount)) return "0%";
  const normalized = Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/\.?0+$/, "");
  return `${normalized}%`;
}

export function vatRateLabel(rate: Pick<VatRate, "name" | "rate_percent">): string {
  return rate.name || formatVatRatePercent(rate.rate_percent);
}

/** Tax-inclusive VAT amount extracted from line total. */
export function calculateInclusiveVatAmount(
  lineAmount: number,
  ratePercent: number,
): number {
  if (!Number.isFinite(lineAmount) || lineAmount <= 0) return 0;
  if (!Number.isFinite(ratePercent) || ratePercent <= 0) return 0;
  return Math.round(((lineAmount * ratePercent) / (100 + ratePercent)) * 100) / 100;
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
