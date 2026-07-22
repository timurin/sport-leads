import assert from "node:assert/strict";
import test from "node:test";

import {
  filterSewingOperations,
  parseSewingCostInput,
  validateSewingOperationDraft,
} from "./sewing-operations.ts";

test("parseSewingCostInput accepts comma and rejects negative", () => {
  assert.equal(parseSewingCostInput("12,5"), "12.50");
  assert.equal(parseSewingCostInput("-1"), null);
  assert.equal(parseSewingCostInput(""), null);
});

test("validateSewingOperationDraft requires name and cost", () => {
  assert.equal(
    validateSewingOperationDraft({ name: "", cost: "10" }),
    "Укажите наименование операции",
  );
  assert.equal(
    validateSewingOperationDraft({ name: "Сборка", cost: "abc" }),
    "Укажите стоимость (число ≥ 0)",
  );
  assert.equal(
    validateSewingOperationDraft({ name: "Сборка", cost: "10,00" }),
    null,
  );
});

test("filterSewingOperations matches name", () => {
  const rows = [
    {
      id: 1,
      name: "Базовая сборка",
      cost: "100.00",
      created_at: "",
      updated_at: "",
    },
    {
      id: 2,
      name: "Отстрочка",
      cost: "50.00",
      created_at: "",
      updated_at: "",
    },
  ];
  assert.equal(filterSewingOperations(rows, "отстр").length, 1);
  assert.equal(filterSewingOperations(rows, "").length, 2);
});
