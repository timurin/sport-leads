import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSewingCatalogTreeRows,
  filterSewingOperations,
  formatDurationMinutesSeconds,
  formatSewingEquipmentLabels,
  nextSewingOperationCopyName,
  parseDurationSecondsInput,
  parseQuantityPerItemInput,
  parseSewingCostInput,
  sewingOperationLineTotal,
  toSewingCostInput,
  toggleSewingWorkCenterId,
  validateSewingOperationDraft,
  visibleSewingCatalogTreeRows,
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

test("validateSewingOperationDraft requires name; description is optional ≤256", () => {
  assert.equal(
    validateSewingOperationDraft({
      name: "",
      description: "",
      folder_id: null,
      work_center_ids: [],
    }),
    "Укажите наименование операции",
  );
  assert.equal(
    validateSewingOperationDraft({
      name: "Сборка",
      description: "x".repeat(257),
      folder_id: null,
      work_center_ids: [],
    }),
    "Описание не длиннее 256 символов",
  );
  assert.equal(
    validateSewingOperationDraft({
      name: "Сборка",
      description: "шов",
      folder_id: null,
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
      description: null,
      folder_id: null,
      sort_order: 0,
      work_center_ids: [],
      created_at: "",
      updated_at: "",
    },
    {
      id: 2,
      name: "Отстрочка",
      description: "кант",
      folder_id: null,
      sort_order: 1,
      work_center_ids: [1],
      created_at: "",
      updated_at: "",
    },
  ];
  assert.equal(filterSewingOperations(rows, "отстр").length, 1);
  assert.equal(filterSewingOperations(rows, "").length, 2);
});

test("buildSewingCatalogTreeRows folders then ops by sort_order", () => {
  const folders = [
    {
      id: 1,
      name: "Root",
      parent_id: null,
      sort_order: 0,
      created_at: "",
      updated_at: "",
    },
    {
      id: 2,
      name: "Child",
      parent_id: 1,
      sort_order: 0,
      created_at: "",
      updated_at: "",
    },
  ];
  const ops = [
    {
      id: 10,
      name: "Op root",
      description: null,
      folder_id: null,
      sort_order: 0,
      work_center_ids: [],
      created_at: "",
      updated_at: "",
    },
    {
      id: 11,
      name: "Op child",
      description: null,
      folder_id: 2,
      sort_order: 0,
      work_center_ids: [],
      created_at: "",
      updated_at: "",
    },
  ];
  const rows = buildSewingCatalogTreeRows(folders, ops);
  assert.deepEqual(
    rows.map((row) => `${row.kind}:${row.id}:${row.depth}`),
    ["folder:1:0", "folder:2:1", "operation:11:2", "operation:10:0"],
  );
  const collapsed = visibleSewingCatalogTreeRows(rows, new Set());
  assert.deepEqual(
    collapsed.map((row) => `${row.kind}:${row.id}`),
    ["folder:1", "operation:10"],
  );
});

test("nextSewingOperationCopyName increments until free", () => {
  assert.equal(
    nextSewingOperationCopyName("Оверлок", ["Оверлок"]),
    "Оверлок (копия)",
  );
  assert.equal(
    nextSewingOperationCopyName("Оверлок", ["Оверлок", "Оверлок (копия)"]),
    "Оверлок (копия 2)",
  );
  assert.equal(
    nextSewingOperationCopyName("Оверлок", [
      "Оверлок",
      "Оверлок (копия)",
      "Оверлок (копия 2)",
    ]),
    "Оверлок (копия 3)",
  );
});
