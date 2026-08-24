import assert from "node:assert/strict";
import test from "node:test";

import {
  duplicateMatchLabel,
  mergeSegmentTags,
  normalizeSegmentName,
  validateSegmentName,
} from "./client-segments.ts";

test("normalizeSegmentName trims and collapses spaces", () => {
  assert.equal(normalizeSegmentName("  VIP  школа "), "VIP школа");
});

test("mergeSegmentTags is case-insensitive and caps at 32", () => {
  assert.deepEqual(mergeSegmentTags(["VIP"], "vip"), ["VIP"]);
  assert.deepEqual(mergeSegmentTags(["VIP"], " школа "), ["VIP", "школа"]);
  const many = Array.from({ length: 32 }, (_, index) => `s${index}`);
  assert.equal(mergeSegmentTags(many, "extra").length, 32);
});

test("validateSegmentName rejects blank and overlong", () => {
  assert.equal(validateSegmentName("   "), "Укажите название сегмента");
  assert.equal(validateSegmentName("ok"), null);
  assert.ok(validateSegmentName("x".repeat(65)));
});

test("duplicateMatchLabel maps match codes", () => {
  assert.equal(duplicateMatchLabel("inn"), "ИНН");
  assert.equal(duplicateMatchLabel("phone"), "телефон");
});
