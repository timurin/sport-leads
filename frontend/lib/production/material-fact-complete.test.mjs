import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  MATERIAL_FACT_GATE_MARKER,
  MATERIAL_FACT_NUMBER_MESSAGE,
  MATERIAL_FACT_OPERATOR_MESSAGE,
  MATERIAL_FACT_REQUIRED_MESSAGE,
  isMaterialFactGateError,
  materialFactSaveError,
  stageMaterialFactDrafts,
  validateMaterialFactQty,
} from "./material-fact-complete.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const stages = [
  { stage_order: 2, production_stage_id: 3 },
  { stage_order: 4, production_stage_id: 2 },
];

const lines = [
  {
    id: 10,
    sequence: 2,
    line_kind: "material",
    snapshot_name: "Сублимационные чернила",
    planned_qty: "8.000",
    fact_qty: null,
    production_stage_id: 3,
    unit: "мг",
  },
  {
    id: 9,
    sequence: 1,
    line_kind: "material",
    snapshot_name: "Сублимационная бумага",
    planned_qty: "0.800",
    fact_qty: "0.750",
    production_stage_id: 3,
    unit: "пм",
  },
  {
    id: 11,
    sequence: 1,
    line_kind: "material",
    snapshot_name: "Ткань",
    planned_qty: "1.200",
    fact_qty: null,
    production_stage_id: 2,
    unit: "м",
  },
  {
    id: 12,
    sequence: 3,
    line_kind: "note",
    snapshot_name: "Комментарий",
    planned_qty: null,
    fact_qty: null,
    production_stage_id: 3,
    unit: null,
  },
];

test("gate error is recognized only by the backend marker", () => {
  const gate = `Cannot complete Печать (print): ${MATERIAL_FACT_GATE_MARKER} for: Сублимационная бумага`;
  assert.equal(isMaterialFactGateError(gate), true);
  assert.equal(isMaterialFactGateError("Недостаточно прав: shop.kanban.transition"), false);
  assert.equal(isMaterialFactGateError("Требуется вход"), false);
  assert.equal(isMaterialFactGateError(null), false);
});

test("stage drafts prefill recorded fact and otherwise the plan", () => {
  const drafts = stageMaterialFactDrafts(stages, lines, 2);
  assert.deepEqual(drafts.map((row) => row.name), [
    "Сублимационная бумага",
    "Сублимационные чернила",
  ]);
  assert.equal(drafts[0].factQty, "0.750");
  assert.equal(drafts[0].plannedQty, "0.800");
  assert.equal(drafts[0].unit, "пм");
  assert.equal(drafts[1].factQty, "8.000");
  assert.equal(drafts[1].plannedQty, "8.000");
  assert.deepEqual(
    stageMaterialFactDrafts(stages, lines, 4).map((row) => row.lineId),
    [11],
  );
  assert.deepEqual(stageMaterialFactDrafts(stages, lines, 9), []);
});

test("drafts stay on the current operation when a workshop has two steps", () => {
  const shared = [
    { stage_order: 2, production_stage_id: 3, tech_operation_id: 1 },
    { stage_order: 3, production_stage_id: 3, tech_operation_id: 2 },
  ];
  const bound = lines.map((line) =>
    line.production_stage_id === 3 ? { ...line, tech_operation_id: 1 } : line,
  );
  assert.deepEqual(
    stageMaterialFactDrafts(shared, bound, 2).map((row) => row.name),
    ["Сублимационная бумага", "Сублимационные чернила"],
  );
  assert.deepEqual(stageMaterialFactDrafts(shared, bound, 3), []);
});

test("fact qty rejects empty, negative and comma values", () => {
  assert.equal(validateMaterialFactQty(""), MATERIAL_FACT_REQUIRED_MESSAGE);
  assert.equal(validateMaterialFactQty("  "), MATERIAL_FACT_REQUIRED_MESSAGE);
  assert.equal(validateMaterialFactQty("-1"), MATERIAL_FACT_NUMBER_MESSAGE);
  assert.equal(validateMaterialFactQty("1,5"), MATERIAL_FACT_NUMBER_MESSAGE);
  assert.equal(validateMaterialFactQty("0"), null);
  assert.equal(validateMaterialFactQty("0.800"), null);
});

test("backend fact validation becomes a field message and the gate stays hidden", () => {
  assert.equal(materialFactSaveError("fact_qty must be >= 0"), MATERIAL_FACT_NUMBER_MESSAGE);
  assert.equal(materialFactSaveError("Invalid fact_qty"), MATERIAL_FACT_NUMBER_MESSAGE);
  assert.equal(
    materialFactSaveError(`Cannot complete Печать (print): ${MATERIAL_FACT_GATE_MARKER} for: Бумага`),
    MATERIAL_FACT_OPERATOR_MESSAGE,
  );
  assert.equal(
    materialFactSaveError("Недостаточно прав: shop.kanban.transition"),
    "Недостаточно прав: shop.kanban.transition",
  );
  assert.equal(materialFactSaveError("Требуется вход"), "Требуется вход");
});

test("kanban complete opens the fact modal from the gate and refreshes after success", () => {
  const kanban = readFileSync(
    join(root, "components/production/shop-stage-kanban-workspace.tsx"),
    "utf8",
  );
  assert.match(kanban, /isMaterialFactGateError\(result\.message\)/);
  assert.match(kanban, /loadStageMaterialFactsAction/);
  assert.match(kanban, /setCompositionFactQtyAction/);
  assert.match(kanban, /completeTechnicalCardStageAction/);
  const failureReturn = kanban.indexOf("if (!result.ok)");
  const refresh = kanban.indexOf("router.refresh()");
  assert.ok(failureReturn > 0);
  assert.ok(refresh > failureReturn);
  assert.equal(kanban.includes(MATERIAL_FACT_GATE_MARKER), false);
  const modal = readFileSync(
    join(root, "components/production/material-fact-complete-modal.tsx"),
    "utf8",
  );
  assert.match(modal, /Фактический расход материалов/);
  assert.match(modal, /Сохранить и завершить/);
  assert.match(modal, /validateMaterialFactQty/);
});
