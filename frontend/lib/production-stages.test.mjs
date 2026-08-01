import assert from "node:assert/strict";
import test from "node:test";

import {
  applyProductionStageOrder,
  filterProductionStages,
  moveProductionStageInOrder,
  nextProductionStageSortOrder,
  validateProductionStageDraft,
} from "./production-stages.ts";

test("validateProductionStageDraft requires valid stage requisites", () => {
  assert.equal(
    validateProductionStageDraft({
      name: "",
      code: "CUTTING",
      is_active: true,
      sort_order: 10,
    }),
    "Укажите наименование цеха",
  );
  assert.equal(
    validateProductionStageDraft({
      name: "Раскрой",
      code: "",
      is_active: true,
      sort_order: 10,
    }),
    "Укажите код цеха",
  );
  assert.equal(
    validateProductionStageDraft({
      name: "Раскрой",
      code: "CUTTING",
      is_active: true,
      sort_order: 10,
    }),
    null,
  );
});

test("filterProductionStages matches name and code", () => {
  const stages = [
    {
      id: 1,
      name: "Раскрой",
      code: "CUTTING",
      is_active: true,
      sort_order: 10,
      created_at: "",
      updated_at: "",
    },
    {
      id: 2,
      name: "Печать",
      code: "PRINT",
      is_active: true,
      sort_order: 20,
      created_at: "",
      updated_at: "",
    },
  ];
  assert.equal(filterProductionStages(stages, "cut").length, 1);
  assert.equal(filterProductionStages(stages, "печ").length, 1);
  assert.equal(filterProductionStages(stages, "").length, 2);
});

test("nextProductionStageSortOrder continues after max", () => {
  assert.equal(nextProductionStageSortOrder([]), 10);
  assert.equal(
    nextProductionStageSortOrder([{ sort_order: 10 }, { sort_order: 30 }]),
    40,
  );
});

test("applyProductionStageOrder renumbers by list position", () => {
  const stages = [
    { id: 2, sort_order: 20 },
    { id: 1, sort_order: 10 },
    { id: 3, sort_order: 30 },
  ];
  assert.deepEqual(applyProductionStageOrder(stages, [3, 1, 2]), [
    { id: 3, sort_order: 10 },
    { id: 1, sort_order: 20 },
    { id: 2, sort_order: 30 },
  ]);
});

test("moveProductionStageInOrder swaps neighbors", () => {
  const stages = [
    { id: 1, sort_order: 10 },
    { id: 2, sort_order: 20 },
    { id: 3, sort_order: 30 },
  ];
  assert.deepEqual(moveProductionStageInOrder(stages, 2, -1), [
    { id: 2, sort_order: 10 },
    { id: 1, sort_order: 20 },
    { id: 3, sort_order: 30 },
  ]);
  assert.equal(moveProductionStageInOrder(stages, 1, -1), null);
  assert.equal(moveProductionStageInOrder(stages, 3, 1), null);
});
