import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildRouteScheme } from "./tech-card-route-choice.ts";
import { assemblyCaption, dayCountLabel, presentPlanSummary, presentRouteMap, routeOperationCountLabel } from "./tech-card-route-map.ts";

const stages = [
  { id: 1, stage_order: 1, production_stage_id: 1, stage_label: "Дизайн", operation_name: "Дизайн", status: "completed" },
  { id: 2, stage_order: 2, production_stage_id: 2, stage_label: "Печать", operation_name: "Сублимационная печать", status: "completed" },
  { id: 3, stage_order: 2, production_stage_id: 2, stage_label: "Печать", operation_name: "Термоперенос", status: "pending" },
  { id: 4, stage_order: 3, production_stage_id: 3, stage_label: "Раскрой", operation_name: "Ручной раскрой", status: "pending" },
  { id: 5, stage_order: 4, production_stage_id: 4, stage_label: "Пошив", operation_name: "Пошив", status: "pending" },
  { id: 6, stage_order: 5, production_stage_id: 5, stage_label: "Контроль качества", operation_name: "ВТО", status: "pending" },
  { id: 7, stage_order: 5, production_stage_id: 5, stage_label: "Контроль качества", operation_name: "Упаковка", status: "pending" },
];

const lines = [
  { sequence: 1, operation_name: "Дизайн", stage_order: 1, production_stage_id: 1, source_kind: "routing" },
  { sequence: 2, operation_name: "Сублимационная печать", stage_order: 2, production_stage_id: 2, source_kind: "routing" },
  { sequence: 3, operation_name: "Термоперенос", stage_order: 2, production_stage_id: 2, source_kind: "routing" },
  { sequence: 4, operation_name: "Ручной раскрой", stage_order: 3, production_stage_id: 3, source_kind: "routing" },
  { sequence: 5, operation_name: "Пошив", stage_order: 4, production_stage_id: 4, source_kind: "routing" },
  { sequence: 6, operation_name: "Пошив базовой футболки", stage_order: 4, production_stage_id: 4, source_kind: "sewing" },
  { sequence: 7, operation_name: "ВТО", stage_order: 5, production_stage_id: 5, source_kind: "routing" },
  { sequence: 8, operation_name: "Упаковка", stage_order: 5, production_stage_id: 5, source_kind: "routing" },
];

function map(extra = {}) {
  return presentRouteMap({
    lines,
    stages,
    columns: buildRouteScheme(lines, stages, []),
    assemblyName: "Пошив базовой футболки",
    currentStageLabel: "Печать",
    currentStageOrder: 2,
    workshopState: "in_progress",
    ...extra,
  });
}

test("workshops keep child operations and sewing is assembly metadata", () => {
  const view = map();
  assert.deepEqual(view.columns.map((column) => column.workshop), ["Дизайн", "Печать", "Раскрой", "Пошив", "Контроль качества"]);
  assert.deepEqual(view.columns[1].steps.map((step) => step.step.kind === "operation" ? step.step.label : ""), ["Сублимационная печать", "Термоперенос"]);
  assert.deepEqual(view.columns[4].steps.map((step) => step.step.kind === "operation" ? step.step.label : ""), ["ВТО", "Упаковка"]);
  assert.equal(view.columns.some((column) => column.workshop === "Пошив базовой футболки"), false);
  assert.equal(view.columns[3].steps.some((step) => step.step.kind === "operation" && step.step.label === "Пошив базовой футболки"), false);
  assert.equal(view.assembly, "Пошив базовой футболки");
  assert.equal(assemblyCaption(null, lines), "Пошив базовой футболки");
});

test("current workshop and operation states come from stage results", () => {
  const view = map();
  assert.equal(view.columns[0].statusLabel, "Завершена");
  assert.equal(view.columns[0].tone, "completed");
  assert.equal(view.columns[1].current, true);
  assert.equal(view.columns[1].statusLabel, "В работе");
  assert.equal(view.columns[1].steps[0].statusLabel, "Завершена");
  assert.equal(view.columns[1].steps[1].statusLabel, "Ожидает");
  assert.equal(view.columns[2].current, false);
  assert.equal(view.columns[2].statusLabel, "Запланирована");
  assert.equal(view.columns[2].steps[0].statusLabel, "Запланирована");
});

test("a waiting current workshop stays distinct from a completed route", () => {
  const waiting = map({ workshopState: "waiting", currentStageLabel: "Дизайн", currentStageOrder: 1 });
  assert.equal(waiting.columns[0].statusLabel, "Ожидает");
  const done = map({
    workshopState: "completed",
    currentStageLabel: "Контроль качества",
    currentStageOrder: 5,
    stages: stages.map((stage) => ({ ...stage, status: "completed" })),
  });
  assert.equal(done.columns.every((column) => column.statusLabel === "Завершена"), true);
});

test("a setup issue is attached to the named operation without the diagnostic code", () => {
  const view = map({
    diagnostics: [{
      code: "missing_linear_meters",
      severity: "error",
      entity_name: "1310-1",
      message: "Операция «Термоперенос»: требуется исправление.",
      fix_action: "Заполните расход для операции.",
      snapshot_node_id: 3,
    }],
  });
  const transfer = view.columns[1].steps[1];
  assert.equal(transfer.issue, "Заполните расход для операции.");
  assert.equal(JSON.stringify(transfer).includes("missing_linear_meters"), false);
  const volume = map({
    diagnostics: [{
      code: "missing_linear_meters",
      severity: "error",
      message: "Операция «Сублимационная печать», ресурс «Печать EPSON 9300»: требуется исправление для поля «Объём операции».",
    }],
  });
  assert.equal(volume.columns[1].steps[0].issue, "Для этой операции не указан расход на одно изделие.");
  assert.equal(view.columns[1].steps[0].issue, null);
});

test("plan summary uses server dates and slack", () => {
  const ready = presentPlanSummary({
    planning_state: "planned",
    replan_required: false,
    planned_start_date: "2026-10-15",
    planned_completion_date: "2026-10-15",
    shipping_date: "2026-10-31",
    on_time: true,
    buffer_days: 16,
    delay_days: 0,
  });
  assert.equal(ready.mode, "ready");
  assert.equal(ready.ready, "15.10.2026");
  assert.equal(ready.shipping, "31.10.2026");
  assert.equal(ready.slack, "16 дней");
  assert.equal(ready.risk, "В срок");
  assert.equal(dayCountLabel(1), "1 день");
  assert.equal(dayCountLabel(2), "2 дня");

  const empty = presentPlanSummary({ planning_state: "unplanned", planned_completion_date: null });
  assert.equal(empty.mode, "empty");
  assert.equal(empty.title, "План не рассчитан");
  assert.equal(empty.actionLabel, "Рассчитать план");

  const stale = presentPlanSummary({
    planning_state: "stale",
    replan_required: true,
    planned_completion_date: "2026-10-15",
    on_time: true,
    buffer_days: 3,
  });
  assert.equal(stale.mode, "stale");
  assert.equal(stale.title, "План нужно обновить");
  assert.equal(stale.actionLabel, "Пересчитать");
  assert.equal(stale.ready, "15.10.2026");
});

test("workshop detail keeps saved plan date, equipment and fact without a second route", () => {
  const view = presentRouteMap({
    lines,
    stages: stages.map((stage) => stage.id === 2
      ? { ...stage, status: "in_progress", work_center_id: 9, performer_name: "Анна", started_at: "2026-10-17T08:00:00Z", source_routing_stage_line_id: 40 }
      : stage.id === 3
        ? { ...stage, source_routing_stage_line_id: 41 }
        : stage),
    columns: buildRouteScheme(lines, stages, []),
    assemblyName: "Пошив базовой футболки",
    currentStageLabel: "Печать",
    currentStageOrder: 2,
    workshopState: "in_progress",
    workCenters: [{ id: 9, name: "Epson SC-F9200" }],
    planSteps: [
      { routing_stage_line_id: 40, planned_start_date: "2026-10-17", planned_end_date: "2026-10-17" },
      { routing_stage_line_id: 41, planned_start_date: "2026-10-18", planned_end_date: "2026-10-19" },
    ],
  });
  const print = view.columns[1];
  assert.equal(print.steps[0].statusLabel, "В работе");
  assert.equal(print.steps[0].planLabel, "17.10.2026");
  assert.equal(print.steps[0].equipment, "Epson SC-F9200");
  assert.equal(print.steps[0].performer, "Анна");
  assert.equal(print.steps[1].statusLabel, "Ожидает");
  assert.equal(print.steps[1].planLabel, "18.10.2026–19.10.2026");
  assert.equal(view.columns.some((column) => column.workshop === "Пошив базовой футболки"), false);
  const count = view.columns.reduce((sum, column) => sum + column.steps.length, 0);
  assert.equal(routeOperationCountLabel(count), "Маршрут · 7 операций");
});

test("planning health status replaces a date guess for the same operation", () => {
  const view = presentRouteMap({
    lines,
    stages,
    columns: buildRouteScheme(lines, stages, []),
    healthOperations: [
      {
        snapshot_node_id: 4,
        operation_name: "Ручной раскрой",
        workshop_id: 3,
        workshop_name: "Раскрой",
        operation_status: "pending",
        planned_start: "2020-01-01",
        planned_end: "2020-01-01",
        is_overdue: false,
        overdue_days: 0,
        is_protected: true,
        can_replan: false,
        warning_code: "manual_replan_protected",
      },
      {
        snapshot_node_id: 5,
        operation_name: "Пошив",
        workshop_id: 4,
        workshop_name: "Пошив",
        operation_status: "pending",
        planned_start: "2026-12-01",
        planned_end: "2026-12-01",
        is_overdue: true,
        overdue_days: 2,
        is_protected: false,
        can_replan: true,
        warning_code: null,
      },
    ],
  });
  const cutting = view.columns.find((column) => column.workshop === "Раскрой");
  const sewing = view.columns.find((column) => column.workshop === "Пошив");
  assert.equal(cutting.steps[0].statusLabel, "Запланирована");
  assert.equal(cutting.steps[0].planLabel, "01.01.2020");
  assert.equal(cutting.steps[0].isProtected, true);
  assert.equal(cutting.steps[0].healthWarning, "Операция защищена: её нельзя переносить.");
  assert.equal(sewing.steps[0].statusLabel, "Просрочена");
  assert.equal(sewing.statusLabel, "Просрочена");
});

test("route map does not recompute dates or launch readiness", () => {
  const source = readFileSync(new URL("./tech-card-route-map.ts", import.meta.url), "utf8");
  assert.equal(source.includes("setDate"), false);
  assert.equal(source.includes("86400000"), false);
  assert.equal(source.includes("can_launch"), false);
  assert.equal(source.includes("planned_date <"), false);
});
