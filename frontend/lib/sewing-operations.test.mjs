import assert from "node:assert/strict";
import test from "node:test";

import {
  filterSewingOperations,
  formatDurationMinutesSeconds,
  formatSewingEquipmentLabels,
  parseDurationSecondsInput,
  parseQuantityPerItemInput,
  parseSewingCostInput,
  sewingOperationLineTotal,
  toSewingCostInput,
  toggleSewingWorkCenterId,
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

test("parseQuantityPerItemInput requires integer ≥ 1", () => {
  assert.equal(parseQuantityPerItemInput("1"), 1);
  assert.equal(parseQuantityPerItemInput("3"), 3);
  assert.equal(parseQuantityPerItemInput("0"), null);
  assert.equal(parseQuantityPerItemInput("-1"), null);
  assert.equal(parseQuantityPerItemInput(""), null);
});

test("sewingOperationLineTotal multiplies cost by quantity", () => {
  assert.equal(sewingOperationLineTotal("10.00", 2), 20);
  assert.equal(sewingOperationLineTotal("50,50", "3"), 151.5);
  assert.equal(sewingOperationLineTotal("10", 0), 10);
});

test("formatDurationMinutesSeconds formats minutes and seconds", () => {
  assert.equal(formatDurationMinutesSeconds(125), "2 минуты 5 секунд");
  assert.equal(formatDurationMinutesSeconds(60), "1 минута 0 секунд");
  assert.equal(formatDurationMinutesSeconds(1), "0 минут 1 секунда");
});

test("validateSewingOperationDraft requires name, cost, qty and duration", () => {
  assert.equal(
    validateSewingOperationDraft({
      name: "",
      cost: "10",
      quantity_per_item: "1",
      duration_seconds: "0",
      work_center_ids: [],
    }),
    "Укажите наименование операции",
  );
  assert.equal(
    validateSewingOperationDraft({
      name: "Сборка",
      cost: "abc",
      quantity_per_item: "1",
      duration_seconds: "0",
      work_center_ids: [],
    }),
    "Укажите стоимость (число ≥ 0)",
  );
  assert.equal(
    validateSewingOperationDraft({
      name: "Сборка",
      cost: "10,00",
      quantity_per_item: "0",
      duration_seconds: "0",
      work_center_ids: [],
    }),
    "Укажите количество операций на 1 изделие (целое ≥ 1)",
  );
  assert.equal(
    validateSewingOperationDraft({
      name: "Сборка",
      cost: "10,00",
      quantity_per_item: "1",
      duration_seconds: "",
      work_center_ids: [],
    }),
    "Укажите время выполнения в секундах (целое ≥ 0)",
  );
  assert.equal(
    validateSewingOperationDraft({
      name: "Сборка",
      cost: "10,00",
      quantity_per_item: "2",
      duration_seconds: "90",
      work_center_ids: [3],
    }),
    null,
  );
});

test("toggleSewingWorkCenterId adds and removes ids", () => {
  assert.deepEqual(toggleSewingWorkCenterId([], 5), [5]);
  assert.deepEqual(toggleSewingWorkCenterId([5, 7], 5), [7]);
  assert.deepEqual(toggleSewingWorkCenterId([5], 9), [5, 9]);
});

test("formatSewingEquipmentLabels joins catalog names", () => {
  assert.equal(formatSewingEquipmentLabels([], []), "—");
  assert.equal(
    formatSewingEquipmentLabels(
      [1, 2],
      [
        { id: 1, name: "Оверлок", code: "OV-1" },
        { id: 2, name: "Прямострочка", code: "ST-1" },
      ],
    ),
    "Оверлок (OV-1), Прямострочка (ST-1)",
  );
  assert.equal(formatSewingEquipmentLabels([99], []), "#99");
});

test("filterSewingOperations matches name", () => {
  const rows = [
    {
      id: 1,
      name: "Базовая сборка",
      cost: "100.00",
      quantity_per_item: 1,
      duration_seconds: 60,
      work_center_ids: [],
      created_at: "",
      updated_at: "",
    },
    {
      id: 2,
      name: "Отстрочка",
      cost: "50.00",
      quantity_per_item: 2,
      duration_seconds: 30,
      work_center_ids: [1],
      created_at: "",
      updated_at: "",
    },
  ];
  assert.equal(filterSewingOperations(rows, "отстр").length, 1);
  assert.equal(filterSewingOperations(rows, "").length, 2);
});
