export type ApiClientSettlementsSummary = {
  currency_code: string;
  open_order_count: number;
  open_order_amount: number | string;
  receivable: number | string;
  advance: number | string;
  paid_total: number | string;
  orders_without_amount_count: number;
  source: string;
  ledger_stage: string;
};

export type ClientSettlementsView = {
  currencyCode: string;
  openOrderCount: number;
  openOrderAmountLabel: string;
  receivableLabel: string;
  advanceLabel: string;
  paidTotalLabel: string;
  ordersWithoutAmountCount: number;
  source: string;
  ledgerStage: string;
};

function formatMoney(amount: number | string, currencyCode: string) {
  const value = Number(amount);
  const safe = Number.isFinite(value) ? value : 0;
  const formatted = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
  const symbol = currencyCode === "RUB" || currencyCode === "" ? "₽" : currencyCode;
  return `${formatted} ${symbol}`;
}

export function fromApiClientSettlements(
  body: ApiClientSettlementsSummary,
): ClientSettlementsView {
  return {
    currencyCode: body.currency_code,
    openOrderCount: body.open_order_count,
    openOrderAmountLabel: formatMoney(body.open_order_amount, body.currency_code),
    receivableLabel: formatMoney(body.receivable, body.currency_code),
    advanceLabel: formatMoney(body.advance, body.currency_code),
    paidTotalLabel: formatMoney(body.paid_total, body.currency_code),
    ordersWithoutAmountCount: body.orders_without_amount_count,
    source: body.source,
    ledgerStage: body.ledger_stage,
  };
}
