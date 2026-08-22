import assert from "node:assert/strict";
import test from "node:test";

import {
  countItemsWithPositiveStock,
  filterByStockPresence,
  hasPositiveStockBalance,
  stockBalanceOrZero,
} from "./stock-balances-filter.ts";

test("stockBalanceOrZero defaults missing rows to 0", () => {
  assert.equal(stockBalanceOrZero({}, 1), "0");
  assert.equal(stockBalanceOrZero({ 1: "12.5" }, 1), "12.5");
  assert.equal(stockBalanceOrZero({ 1: "" }, 1), "0");
});

test("hasPositiveStockBalance rejects zero and non-numeric", () => {
  assert.equal(hasPositiveStockBalance("0"), false);
  assert.equal(hasPositiveStockBalance("0.000"), false);
  assert.equal(hasPositiveStockBalance("1"), true);
  assert.equal(hasPositiveStockBalance("abc"), false);
});

test("countItemsWithPositiveStock uses ledger balances only", () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.equal(
    countItemsWithPositiveStock(items, { 1: "0", 2: "3", 3: "0.5" }),
    2,
  );
  assert.equal(countItemsWithPositiveStock(items, {}), 0);
});

test("filterByStockPresence keeps only positive balances", () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const balances = { 1: "0", 2: "3", 3: "0.5" };
  assert.deepEqual(
    filterByStockPresence(items, balances, "in_stock").map((row) => row.id),
    [2, 3],
  );
  assert.equal(filterByStockPresence(items, balances, "all").length, 3);
  assert.equal(filterByStockPresence(items, {}, "in_stock").length, 0);
});
