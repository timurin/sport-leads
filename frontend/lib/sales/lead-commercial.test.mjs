import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCommercialDate,
  formatQuantity,
  getEventDateWarning,
  parseNonNegativeNumber,
  parsePercent,
  parsePositiveInteger,
  validateCommercialDates,
} from "./lead-commercial.ts";

test("validates quantities, money and percentages", () => {
  assert.deepEqual(parsePositiveInteger(""), {});
  assert.equal(parsePositiveInteger("0").error, "Укажите целое число не меньше 1.");
  assert.equal(parsePositiveInteger("2.5").error, "Укажите целое число не меньше 1.");
  assert.equal(parsePositiveInteger("45").value, 45);
  assert.equal(parseNonNegativeNumber("-1").error, "Укажите неотрицательное число.");
  assert.equal(parseNonNegativeNumber("480000").value, 480000);
  assert.equal(parsePercent("101").error, "Значение должно быть от 0 до 100%.");
  assert.equal(parsePercent("0").value, 0);
});

test("validates and formats commercial dates", () => {
  assert.ok(validateCommercialDates("2026-07-20", "2026-07-19"));
  assert.equal(validateCommercialDates("2026-07-20", "2026-08-20"), undefined);
  assert.ok(getEventDateWarning("2026-09-02", "2026-09-01"));
  assert.equal(formatCommercialDate("2026-07-16"), "16 июля 2026");
  assert.equal(formatCommercialDate("2026-02-30"), "Не указано");
  assert.equal(formatCommercialDate("invalid"), "Не указано");
});

test("uses Russian quantity forms", () => {
  assert.equal(formatQuantity(1), "1 изделие");
  assert.equal(formatQuantity(2), "2 изделия");
  assert.equal(formatQuantity(5), "5 изделий");
  assert.equal(formatQuantity(21, "kit"), "21 комплект");
  assert.equal(formatQuantity(undefined), "Не указано");
});
