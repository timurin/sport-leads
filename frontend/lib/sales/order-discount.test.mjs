import assert from "node:assert/strict";
import test from "node:test";

import { parseOrderDiscountPercentInput } from "./order-discount.ts";

test("parseOrderDiscountPercentInput accepts empty, comma, and bounds", () => {
  assert.deepEqual(parseOrderDiscountPercentInput(""), { ok: true, value: null });
  assert.deepEqual(parseOrderDiscountPercentInput("  "), { ok: true, value: null });
  assert.deepEqual(parseOrderDiscountPercentInput("10"), { ok: true, value: "10.00" });
  assert.deepEqual(parseOrderDiscountPercentInput("7,5"), { ok: true, value: "7.50" });
  assert.deepEqual(parseOrderDiscountPercentInput("0"), { ok: true, value: "0.00" });
  assert.deepEqual(parseOrderDiscountPercentInput("100"), { ok: true, value: "100.00" });
  assert.equal(parseOrderDiscountPercentInput("-1").ok, false);
  assert.equal(parseOrderDiscountPercentInput("100.01").ok, false);
  assert.equal(parseOrderDiscountPercentInput("abc").ok, false);
});
