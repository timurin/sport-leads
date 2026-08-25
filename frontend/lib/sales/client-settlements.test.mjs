import assert from "node:assert/strict";
import test from "node:test";

import { fromApiClientSettlements } from "./client-settlements.ts";

test("maps settlements summary labels without inventing ledger source", () => {
  const view = fromApiClientSettlements({
    currency_code: "RUB",
    open_order_count: 2,
    open_order_amount: "10100.00",
    receivable: "7000.00",
    advance: "50.00",
    paid_total: "8150.00",
    orders_without_amount_count: 1,
    source: "sales_order_payment_markers",
    ledger_stage: "14.2",
  });
  assert.equal(view.openOrderCount, 2);
  assert.equal(view.ordersWithoutAmountCount, 1);
  assert.equal(view.source, "sales_order_payment_markers");
  assert.equal(view.ledgerStage, "14.2");
  assert.match(view.receivableLabel, /7/);
  assert.match(view.advanceLabel, /50/);
  assert.match(view.paidTotalLabel, /8/);
  assert.match(view.openOrderAmountLabel, /10/);
  assert.match(view.receivableLabel, /₽/);
});
