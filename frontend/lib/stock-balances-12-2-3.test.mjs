import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  formatStockBalanceQty,
  filterByStockPresence,
  stockBalanceOrZero,
} from "./stock-balances-filter.ts";

async function readSource(relativeFromLib) {
  const path = fileURLToPath(new URL(relativeFromLib, import.meta.url));
  return readFile(path, "utf8");
}

test("formatStockBalanceQty strips trailing zeros from ledger qty", () => {
  assert.equal(formatStockBalanceQty("10.000"), "10");
  assert.equal(formatStockBalanceQty("7.500"), "7.5");
  assert.equal(formatStockBalanceQty("0"), "0");
  assert.equal(formatStockBalanceQty(null), "0");
  assert.equal(formatStockBalanceQty("abc"), "0");
});

test("stockBalanceOrZero formats live ledger map for list column", () => {
  assert.equal(stockBalanceOrZero({ 1: "12.500" }, 1), "12.5");
  assert.equal(stockBalanceOrZero({}, 2), "0");
});

test("filterByStockPresence keeps positive live balances", () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const balances = { 1: "0.000", 2: "3.000", 3: "0.5" };
  assert.deepEqual(
    filterByStockPresence(items, balances, "in_stock").map((row) => row.id),
    [2, 3],
  );
});

test("warehouse stock catalog loads balances for live column (12.2.3)", async () => {
  const catalog = await readSource("./warehouse-nomenclature.ts");
  assert.ok(catalog.includes("getNomenclatureStockBalances"));
  assert.ok(catalog.includes("stockBalances"));
  assert.ok(catalog.includes("12.2.3"));

  const client = await readSource("./stock-balances.ts");
  assert.ok(client.includes("/stock/balances"));
  assert.ok(client.includes("12.2.2") || client.includes("12.2.3"));

  const page = await readSource(
    "../app/(workspace)/warehouse/stock/page.tsx",
  );
  assert.ok(page.includes("loadWarehouseNomenclatureCatalog"));
  assert.ok(page.includes("WarehouseNomenclatureWorkspace"));
});
