import assert from "node:assert/strict";
import test from "node:test";

import { formatRollupQty } from "./production-orders.ts";

test("formatRollupQty strips trailing zeros and handles empty", () => {
  assert.equal(formatRollupQty("3.000"), "3");
  assert.equal(formatRollupQty("0.500"), "0.5");
  assert.equal(formatRollupQty(null), "—");
  assert.equal(formatRollupQty(""), "—");
  assert.equal(formatRollupQty("12"), "12");
});
