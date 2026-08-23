import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  dynamicsSeriesTotals,
  niceAxisMax,
} from "./dashboard/sales-dynamics-scale.ts";

test("niceAxisMax rounds up to 1/2/5 × 10^n", () => {
  assert.equal(niceAxisMax(0), 1);
  assert.equal(niceAxisMax(3), 5);
  assert.equal(niceAxisMax(7), 10);
  assert.equal(niceAxisMax(1200), 2000);
});

test("dynamicsSeriesTotals sums counts and order amount", () => {
  const totals = dynamicsSeriesTotals([
    { leads: 2, deals: 1, orders: 1, orderAmount: 100 },
    { leads: 3, deals: 0, orders: 2, orderAmount: 50 },
  ]);
  assert.deepEqual(totals, { leads: 5, deals: 1, orders: 3, orderAmount: 150 });
});

test("sales dynamics chart uses compact Metrika-style chrome", async () => {
  const path = fileURLToPath(
    new URL("../components/dashboard/sales-dynamics-chart.tsx", import.meta.url),
  );
  const source = await readFile(path, "utf8");
  for (const marker of [
    'from "recharts"',
    "LineChart",
    "h-[168px]",
    "#8A56E2",
    "niceAxisMax",
    "dynamicsSeriesTotals",
    "strokeWidth={2}",
  ]) {
    assert.ok(source.includes(marker), `missing chart marker: ${marker}`);
  }
  assert.ok(!source.includes("h-auto min-h-[220px]"));
  assert.ok(!source.includes("min-h-[220px]"));
});
