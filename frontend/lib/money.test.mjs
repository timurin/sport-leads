import assert from "node:assert/strict";
import test from "node:test";

import {
  currencyOptionLabel,
  currencySymbol,
  formatAmountWithCurrency,
  normalizeCurrencyCode,
} from "./money.ts";

test("currencySymbol maps RUB to ruble sign", () => {
  assert.equal(currencySymbol("RUB"), "₽");
  assert.equal(currencySymbol("rub"), "₽");
  assert.equal(currencySymbol(null), "₽");
  assert.equal(currencySymbol(""), "₽");
});

test("currencySymbol keeps other known symbols", () => {
  assert.equal(currencySymbol("USD"), "$");
  assert.equal(currencySymbol("EUR"), "€");
  assert.equal(currencySymbol("GBP"), "GBP");
});

test("formatAmountWithCurrency never prints RUB", () => {
  assert.equal(formatAmountWithCurrency("1500.00", "RUB"), "1500.00 ₽");
  assert.equal(formatAmountWithCurrency(10, "USD"), "10 $");
});

test("currencyOptionLabel prefers symbol", () => {
  assert.equal(currencyOptionLabel("RUB"), "₽");
  assert.equal(normalizeCurrencyCode(" eur "), "EUR");
});
