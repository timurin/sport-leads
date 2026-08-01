import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAmountWithVat,
  calculateAmountWithoutVat,
  calculateExclusiveVatAmount,
  calculateInclusiveVatAmount,
  calculateLineGrossAmount,
  calculateLineVatAmount,
} from "./vat-rates.ts";

test("НДС сверху (exclusive): 5% and 22%", () => {
  assert.equal(calculateExclusiveVatAmount(10_000, 5), 500);
  assert.equal(calculateAmountWithVat(10_000, 5), 10_500);

  assert.equal(calculateExclusiveVatAmount(10_000, 22), 2_200);
  assert.equal(calculateAmountWithVat(10_000, 22), 12_200);
});

test("НДС в сумме (inclusive): extract 5% and 22%", () => {
  assert.equal(calculateInclusiveVatAmount(10_500, 5), 500);
  assert.equal(calculateAmountWithoutVat(10_500, 5), 10_000);

  assert.equal(calculateInclusiveVatAmount(12_200, 22), 2_200);
  assert.equal(calculateAmountWithoutVat(12_200, 22), 10_000);
});

test("Без НДС (0%): vat=0, amounts unchanged", () => {
  assert.equal(calculateExclusiveVatAmount(10_000, 0), 0);
  assert.equal(calculateAmountWithVat(10_000, 0), 10_000);
  assert.equal(calculateInclusiveVatAmount(10_000, 0), 0);
  assert.equal(calculateAmountWithoutVat(10_000, 0), 10_000);
});

test("classic 20% reference examples from owner note", () => {
  assert.equal(calculateExclusiveVatAmount(10_000, 20), 2_000);
  assert.equal(calculateAmountWithVat(10_000, 20), 12_000);
  assert.equal(calculateInclusiveVatAmount(12_000, 20), 2_000);
  assert.equal(calculateAmountWithoutVat(12_000, 20), 10_000);
});

test("line VAT mode helper: в сумме vs сверху", () => {
  assert.equal(calculateLineVatAmount(12_200, 22, true), 2_200);
  assert.equal(calculateLineGrossAmount(12_200, 22, true), 12_200);
  assert.equal(calculateLineVatAmount(10_000, 22, false), 2_200);
  assert.equal(calculateLineGrossAmount(10_000, 22, false), 12_200);
});
