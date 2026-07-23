import assert from "node:assert/strict";
import test from "node:test";

import {
  filterSewingOperations,
  formatDurationMinutesSeconds,
  parseDurationSecondsInput,
  parseSewingCostInput,
  toSewingCostInput,
  validateSewingOperationDraft,
} from "./sewing-operations.ts";

test("parseSewingCostInput accepts comma and rejects negative", () => {
  assert.equal(parseSewingCostInput("12,5"), "12.50");
  assert.equal(parseSewingCostInput("-1"), null);
  assert.equal(parseSewingCostInput(""), null);
  assert.equal(parseSewingCostInput("1\u00a0500,00"), "1500.00");
});

test("toSewingCostInput uses ASCII decimals for edit drafts", () => {
  assert.equal(toSewingCostInput("150.00"), "150.00");
  assert.equal(toSewingCostInput(151), "151.00");
  assert.equal(toSewingCostInput(undefined), "0.00");
});

test("parseDurationSecondsInput accepts integers and rejects invalid", () => {
  assert.equal(parseDurationSecondsInput("125"), 125);
  assert.equal(parseDurationSecondsInput("0"), 0);
  assert.equal(parseDurationSecondsInput("-1"), null);
  assert.equal(parseDurationSecondsInput("1.5"), null);
  assert.equal(parseDurationSecondsInput(""), null);
});

test("formatDurationMinutesSeconds formats minutes and seconds", () => {
  assert.equal(formatDurationMinutesSeconds(125), "2 минуты 5 секунд");
  assert.equal(formatDurationMinutesSeconds(60), "1 минута 0 секунд");
  assert.equal(formatDurationMinutesSeconds(1), "0 минут 1 секунда");
});

test("validateSewingOperationDraft requires name, cost and duration", () => {
  assert.equal(
    validateSewingOperationDraft({ name: "", cost: "10", duration_seconds: "0" }),
    "Укажите наименование операции",
  );
  assert.equal(
    validateSewingOperationDraft({
      name: "Сборка",
      cost: "abc",
      duration_seconds: "0",
    }),
    "Укажите стоимость (число ≥ 0)",
  );
  assert.equal(
    validateSewingOperationDraft({
      name: "Сборка",
      cost: "10,00",
      duration_seconds: "",
    }),
    "Укажите время выполнения в секундах (целое ≥ 0)",
  );
  assert.equal(
    validateSewingOperationDraft({
      name: "Сборка",
      cost: "10,00",
      duration_seconds: "90",
    }),
    null,
  );
});

test("filterSewingOperations matches name", () => {
  const rows = [
    {
      id: 1,
      name: "Базовая сборка",
      cost: "100.00",
      duration_seconds: 60,
      created_at: "",
      updated_at: "",
    },
    {
      id: 2,
      name: "Отстрочка",
      cost: "50.00",
      duration_seconds: 30,
      created_at: "",
      updated_at: "",
    },
  ];
  assert.equal(filterSewingOperations(rows, "отстр").length, 1);
  assert.equal(filterSewingOperations(rows, "").length, 2);
});
