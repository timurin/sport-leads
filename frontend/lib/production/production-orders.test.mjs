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
