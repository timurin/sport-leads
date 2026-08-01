import assert from "node:assert/strict";
import test from "node:test";

import {
  TECH_OPERATION_VOLUME_UNIT_LABELS,
  filterTechOperations,
  formatTechOperationVolumeUnit,
  validateTechOperationDraft,
} from "./tech-operations.ts";

test("formatTechOperationVolumeUnit maps API units to Russian labels", () => {
  assert.equal(formatTechOperationVolumeUnit("linear_meters"), "м.п.");
  assert.equal(formatTechOperationVolumeUnit("pieces"), "шт.");
  assert.deepEqual(TECH_OPERATION_VOLUME_UNIT_LABELS, {
    linear_meters: "м.п.",
    pieces: "шт.",
  });
});

test("validateTechOperationDraft requires name, code and volume unit", () => {
  assert.equal(
    validateTechOperationDraft({
      name: "",
      code: "OP-1",
      volume_unit: "pieces",
      production_stage_id: null,
      is_active: true,
      required_materials: [],
    }),
    "Укажите наименование операции",
  );
  assert.equal(
    validateTechOperationDraft({
      name: "Раскрой",
      code: "",
      volume_unit: "pieces",
      production_stage_id: null,
      is_active: true,
      required_materials: [],
    }),
    "Укажите код операции",
  );
  assert.equal(
    validateTechOperationDraft({
      name: "Раскрой",
      code: "CUT",
      volume_unit: "pieces",
      production_stage_id: null,
      is_active: true,
      required_materials: [],
    }),
    null,
  );
  assert.equal(
    validateTechOperationDraft({
      name: "Сублимация",
      code: "SUBL",
      volume_unit: "linear_meters",
      production_stage_id: null,
      is_active: true,
      required_materials: [{ nomenclature_id: 0, quantity: "1" }],
    }),
    "Выберите материал для required materials",
  );
});

test("filterTechOperations matches name and code", () => {
  const rows = [
    {
      id: 1,
      name: "Раскрой",
      code: "CUT",
      volume_unit: "linear_meters",
      production_stage_id: null,
      is_active: true,
      required_materials: [],
      sort_order: 0,
      created_at: "",
      updated_at: "",
    },
    {
      id: 2,
      name: "Печать",
      code: "PRT",
      volume_unit: "pieces",
      production_stage_id: null,
      is_active: true,
      required_materials: [],
      sort_order: 1,
      created_at: "",
      updated_at: "",
    },
  ];
  assert.equal(filterTechOperations(rows, "cut").length, 1);
  assert.equal(filterTechOperations(rows, "печ").length, 1);
  assert.equal(filterTechOperations(rows, "").length, 2);
});
