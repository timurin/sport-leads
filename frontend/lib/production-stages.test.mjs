import assert from "node:assert/strict";
import test from "node:test";

import {
  filterProductionStages,
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
