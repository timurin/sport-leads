import assert from "node:assert/strict";
import test from "node:test";

test("StockBalanceRow type accepts optional warehouse_id (contract 12.1.2)", () => {
  const aggregated = {
    nomenclature_id: 1,
    quantity: "3",
    warehouse_id: null,
  };
  const scoped = {
    nomenclature_id: 1,
    quantity: "3",
    warehouse_id: 2,
  };
  assert.equal(aggregated.warehouse_id, null);
  assert.equal(scoped.warehouse_id, 2);
});
