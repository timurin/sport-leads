import assert from "node:assert/strict";
import test from "node:test";

import {
  countProductionOrdersByStatus,
  formatRollupQty,
} from "./production-orders.ts";

test("countProductionOrdersByStatus uses existing status field only", () => {
  const counts = countProductionOrdersByStatus([
    { status: "in_progress" },
    { status: "in_progress" },
    { status: "draft" },
    { status: "completed" },
    { status: "unknown" },
  ]);
  assert.equal(counts.in_progress, 2);
  assert.equal(counts.draft, 1);
  assert.equal(counts.completed, 1);
  assert.equal(counts.cancelled, 0);
});

test("formatRollupQty strips trailing zeros and handles empty", () => {
  assert.equal(formatRollupQty("3.000"), "3");
  assert.equal(formatRollupQty("0.500"), "0.5");
  assert.equal(formatRollupQty(null), "—");
  assert.equal(formatRollupQty(""), "—");
  assert.equal(formatRollupQty("12"), "12");
});

test("standalone PO create wiring (28.5.2)", async () => {
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const read = (rel) =>
    readFile(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

  const client = await read("./production-orders.ts");
  assert.ok(client.includes("order_group_id?: number"));
  assert.ok(client.includes("sales_order_id?: number"));

  const actions = await read(
    "../../app/(workspace)/production/orders/production-order-actions.ts",
  );
  assert.ok(actions.includes("order_group_id"));

  const list = await read(
    "../../components/production/production-orders-workspace.tsx",
  );
  assert.ok(list.includes("data-standalone-production-order-create"));
  assert.ok(list.includes("Standalone-группа"));

  const detail = await read(
    "../../components/production/production-order-detail-workspace.tsx",
  );
  assert.ok(detail.includes("order.sales_order_id != null"));
  assert.ok(detail.includes("Standalone-группа"));
});
