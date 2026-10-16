import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRouteScheme,
  daysEarlierLabel,
  FORECAST_EMPTY,
  managerBlockerText,
  managerBlockers,
  managerWarningCallout,
  recommendationEarlierText,
  routeChoiceRecommendation,
} from "./tech-card-route-choice.ts";

const stages = [
  { id: 11, stage_order: 1, production_stage_id: 3, stage_label: "Печать" },
  { id: 12, stage_order: 2, production_stage_id: 4, stage_label: "Раскрой" },
  { id: 13, stage_order: 3, production_stage_id: 4, stage_label: "Раскрой" },
  { id: 14, stage_order: 4, production_stage_id: 4, stage_label: "Раскрой" },
  { id: 15, stage_order: 5, production_stage_id: 5, stage_label: "Пошив" },
];

const lines = [
  { sequence: 1, operation_name: "Печать", stage_order: 1, production_stage_id: 3 },
  { sequence: 2, operation_name: "Ручной раскрой", stage_order: 2, production_stage_id: 4 },
  { sequence: 3, operation_name: "Раскрой настилом", stage_order: 3, production_stage_id: 4 },
  { sequence: 4, operation_name: "Раскрой лазером", stage_order: 4, production_stage_id: 4 },
  { sequence: 5, operation_name: "Пошив", stage_order: 5, production_stage_id: 5 },
];

test("route without ONE OF stays a workshop sequence", () => {
  const scheme = buildRouteScheme(lines.slice(0, 1).concat(lines.slice(4)), stages, []);
  assert.deepEqual(scheme.map((column) => column.workshop), ["Печать", "Пошив"]);
  assert.equal(scheme.every((column) => column.steps.every((step) => step.kind === "operation")), true);
});

test("ONE OF is one block and keeps preliminary selection", () => {
  const scheme = buildRouteScheme(lines, stages, [{
    group: {
      id: "cut",
      workshop_id: 4,
      name: "Раскрой",
      code: null,
      selection_mode: "one_of",
      members: [
        { operation_node_id: "snapshot:12", position: 1 },
        { operation_node_id: "snapshot:13", position: 2 },
        { operation_node_id: "snapshot:14", position: 3 },
      ],
      default_operation_node_id: "snapshot:12",
      active: true,
    },
    selected_operation_snapshot_node_id: "snapshot:13",
    selection_status: "preliminary",
  }]);
  const variant = scheme.flatMap((column) => column.steps).find((step) => step.kind === "variant");
  assert.equal(variant?.caption, "Выполняется один вариант");
  assert.equal(variant?.status, "preliminary");
  assert.deepEqual(variant?.options.map((option) => option.label), ["Ручной раскрой", "Раскрой настилом", "Раскрой лазером"]);
  assert.equal(variant?.options.filter((option) => option.selected).length, 1);
  assert.equal(variant?.options.find((option) => option.selected)?.status, "preliminary");
  assert.equal(scheme.flatMap((column) => column.steps).filter((step) => step.kind === "operation" && step.label.includes("раскрой")).length, 0);
});

test("confirmed selection is marked on the chosen option", () => {
  const scheme = buildRouteScheme(lines.slice(1, 3), stages, [{
    group: {
      id: "cut",
      workshop_id: 4,
      name: "Раскрой",
      code: null,
      selection_mode: "one_of",
      members: [
        { operation_node_id: "snapshot:12", position: 1 },
        { operation_node_id: "snapshot:13", position: 2 },
      ],
      default_operation_node_id: "snapshot:12",
      active: true,
    },
    selected_operation_snapshot_node_id: "snapshot:12",
    selection_status: "confirmed",
  }]);
  const variant = scheme[0]?.steps[0];
  assert.equal(variant?.kind, "variant");
  if (variant?.kind !== "variant") return;
  assert.equal(variant.status, "confirmed");
  assert.equal(variant.options.find((option) => option.isDefault)?.selected, true);
});

test("manager blockers hide internal reason codes", () => {
  const norm = managerBlockerText({ code: "manual_required", reason: "missing_operator_norm" }, "Ручной раскрой");
  assert.equal(norm, "Не настроена производственная норма операции «Ручной раскрой». Обратитесь к администратору производства.");
  assert.equal(norm.includes("missing_operator_norm"), false);
  assert.equal(norm.includes("manual_required"), false);
  const blockers = managerBlockers(
    [{ code: "manual_required", reason: "missing_operator_norm", routing_stage_line_id: 8 }],
    [{ routing_stage_line_id: 8, snapshot_node_id: 12 }],
    stages,
    lines,
  );
  assert.equal(blockers.headline, "Маршрут требует настройки");
  assert.equal(blockers.items[0]?.includes("Ручной раскрой"), true);
  assert.equal(JSON.stringify(blockers).includes("missing_operator_norm"), false);
  const namedWithoutSteps = managerBlockers(
    [{ code: "manual_required", reason: "missing_operator_norm", routing_stage_line_id: 71 }],
    [],
    [{ id: 294, stage_order: 1, stage_label: "Печать", source_routing_stage_line_id: 71, operation_name: "Подготовка макетов" }],
    [],
  );
  assert.equal(namedWithoutSteps.items[0]?.includes("Подготовка макетов"), true);
});

test("recommendation stays a backend gap until alternative ETAs arrive", () => {
  assert.deepEqual(routeChoiceRecommendation({}), { supported: false, gap: "BACKEND GAP" });
  assert.deepEqual(
    routeChoiceRecommendation({ selectedCompletionDate: "2026-10-20", alternatives: null }),
    { supported: false, gap: "BACKEND GAP" },
  );
  const ready = routeChoiceRecommendation({
    selectedCompletionDate: "2026-10-20",
    alternatives: [
      { name: "Ручной раскрой", planned_completion_date: "2026-10-20" },
      { name: "Раскрой лазером", planned_completion_date: "2026-10-17" },
    ],
  });
  assert.deepEqual(ready, { supported: true, name: "Раскрой лазером", daysEarlier: 3 });
  assert.equal(daysEarlierLabel(3), "Готовность на 3 дня раньше");
  assert.equal(recommendationEarlierText(2), "Ожидаемая готовность на 2 дня раньше");
});

test("warning callout keeps one setup note and forecast empty state is explicit", () => {
  const callout = managerWarningCallout(managerBlockers(
    [{ code: "manual_required", reason: "missing_operator_norm", routing_stage_line_id: 8 }],
    [{ routing_stage_line_id: 8, snapshot_node_id: 12 }],
    stages,
    lines,
  ));
  assert.equal(callout?.title, "Маршрут требует настройки");
  assert.equal(callout?.lines[0], "Не настроена производственная норма операции «Ручной раскрой».");
  assert.equal(callout?.note, "Настройку выполняет администратор производства.");
  assert.equal(JSON.stringify(callout).includes("missing_operator_norm"), false);
  assert.equal(FORECAST_EMPTY, "Прогноз появится после расчёта плана");
  assert.equal(managerWarningCallout({ headline: null, items: [] }), null);
});
