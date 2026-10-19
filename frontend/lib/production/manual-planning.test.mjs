import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  FACT_STEP_LABEL,
  REPLAN_CAPACITY,
  REPLAN_CHANGED,
  REPLAN_DEPENDENCY,
  REPLAN_DOWNSTREAM_HINT,
  REPLAN_PROTECTED,
  buildPlanningRoute,
  canApplyReplan,
  filterPlanningCards,
  groupPlanningCards,
  planningBadges,
  planningEmptyLabel,
  planningManagerLines,
  planningProgressLabel,
  planningProgressShort,
  planningQuantityLabel,
  planningReplanCount,
  planningScheduleLine,
  readReplanConflict,
  readReplanPreview,
  replanApplyBody,
  replanDownstreamLines,
  replanPreviewBody,
  replanRiskLabel,
  replanSelectedLine,
  replanSlackLabel,
  routeMarker,
  routeStateLabel,
} from "./manual-planning.ts";

const root = dirname(fileURLToPath(import.meta.url));

function assignment(patch) {
  return {
    id: 1,
    technical_card_id: 10,
    technical_card_number: "1310-1",
    order_number: "1310",
    nomenclature_name: "Форма",
    quantity: "12",
    production_stage_id: 3,
    production_stage_name: "Пошив",
    planned_date: "2026-10-20",
    position: 1,
    note: null,
    updated_at: "2026-10-16T09:00:00Z",
    snapshot_node_id: 100,
    operation_name: "Пошив",
    operation_status: "pending",
    operation_state: "future",
    production_state: {
      lifecycle_status: "in_progress",
      current_workshop_id: 2,
      current_workshop_name: "Сублимация",
      planning_state: "planned",
    },
    ...patch,
  };
}

const stages = [
  { id: 1, stage_order: 1, stage_label: "Дизайн", operation_name: "Дизайн", status: "completed" },
  { id: 2, stage_order: 2, stage_label: "Сублимация", operation_name: "Сублимация", status: "in_progress" },
  { id: 3, stage_order: 3, stage_label: "Термоперенос", operation_name: "Термоперенос", status: "pending" },
];

test("one technical card is one planning row", () => {
  const rows = groupPlanningCards([
    assignment({ id: 1, snapshot_node_id: 3, planned_date: "2026-10-20" }),
    assignment({ id: 2, snapshot_node_id: 4, planned_date: "2026-10-22", production_stage_name: "Раскрой" }),
    assignment({ id: 3, technical_card_id: 11, technical_card_number: "1311-1", order_number: "1311" }),
    assignment({ id: 4, technical_card_id: 12, production_state: { lifecycle_status: "completed", planning_state: "planned" } }),
  ], new Map([[10, { productModelName: "Куртка", shippingDate: "2026-10-28", stageResults: stages }]]));
  assert.deepEqual(rows.map((item) => item.technicalCardId), [10, 11]);
  assert.equal(rows[0].model, "Куртка");
  assert.equal(rows[0].assignments.length, 2);
  assert.equal(planningProgressLabel(rows[0]), "1 из 3 завершено");
  assert.equal(rows[1].shippingDate, null);
});

test("filters search, workshop, replan and shipping without duplicating a card", () => {
  const cards = groupPlanningCards([
    assignment({}),
    assignment({ id: 8, technical_card_id: 20, order_number: "2000", technical_card_number: "2000-1", nomenclature_name: "Шорты", production_state: { lifecycle_status: "in_progress", current_workshop_id: 9, current_workshop_name: "Пошив", planning_state: "stale" } }),
  ], new Map([[10, { shippingDate: "2026-10-28" }]]));
  const all = { search: "", stageId: null, attention: "all", shippingDate: "" };
  assert.equal(filterPlanningCards(cards, { ...all, search: "форма" }).length, 1);
  assert.equal(filterPlanningCards(cards, { ...all, search: "нет такой" }).length, 0);
  assert.equal(filterPlanningCards(cards, { ...all, search: "1310" }).length, 1);
  assert.equal(filterPlanningCards(cards, { ...all, stageId: 2 })[0].technicalCardId, 10);
  assert.equal(filterPlanningCards(cards, { ...all, attention: "replan" })[0].technicalCardId, 20);
  assert.equal(filterPlanningCards(cards, { ...all, attention: "clear" })[0].technicalCardId, 10);
  assert.equal(filterPlanningCards(cards, { ...all, attention: "overdue" }).length, 0);
  assert.equal(filterPlanningCards(cards, { ...all, attention: "risk" }).length, 0);
  assert.equal(filterPlanningCards(cards, { ...all, shippingDate: "2026-10-28" }).length, 1);
  assert.equal(filterPlanningCards(cards, { ...all, shippingDate: "2026-11-01" }).length, 0);
});

test("plan badges and empty states use server flags and do not invent overdue days", () => {
  const [saved, stale] = groupPlanningCards([
    assignment({}),
    assignment({ id: 8, technical_card_id: 20, production_state: { lifecycle_status: "in_progress", planning_state: "stale" } }),
  ]);
  assert.deepEqual(planningBadges(saved, null).map((item) => item.label), ["План сохранён"]);
  assert.deepEqual(planningBadges(stale, null).map((item) => item.label), ["Требует перепланирования"]);
  const risk = planningBadges(saved, { planning_state: "planned", is_current: true, replan_required: false, planned_start_date: null, planned_completion_date: "2026-10-31", shipping_date: "2026-10-30", on_time: false, buffer_days: -1, delay_days: 1 });
  assert.equal(risk[0].label, "Риск срока");
  assert.equal(risk[0].detail, "ETA 31.10.2026 · Отгрузка 30.10.2026");
  assert.deepEqual(planningBadges(saved, { planning_state: "planned", is_current: false, replan_required: true, planned_start_date: null, planned_completion_date: null, shipping_date: null, on_time: true, buffer_days: 1, delay_days: 0 }).map((item) => item.label), ["Требует перепланирования"]);
  assert.deepEqual(planningBadges(saved, { planning_state: "planned", is_current: true, replan_required: false, planned_start_date: null, planned_completion_date: "2026-10-27", shipping_date: "2026-11-07", on_time: true, buffer_days: 11, delay_days: 0 }).map((item) => item.label), ["План актуален"]);
  assert.deepEqual(planningBadges(stale, { planning_state: "stale", is_current: false, replan_required: true, planned_start_date: null, planned_completion_date: "2026-10-31", shipping_date: "2026-10-30", on_time: false, buffer_days: -1, delay_days: 1 }).map((item) => item.label), ["Риск срока"]);
  assert.equal(planningProgressShort({ completedSteps: 4, totalSteps: 7 }), "4 из 7");
  assert.equal(planningProgressShort(saved), "Маршрут откроется в карточке");
  assert.equal(planningQuantityLabel("4.000"), "4 шт.");
  assert.equal(planningScheduleLine("2026-10-31", "2026-10-30"), "ETA 30.10.2026 · Отгрузка 31.10.2026");
  assert.equal(planningReplanCount([saved, stale]), 1);
  assert.deepEqual(planningManagerLines({ planning_state: "planned", is_current: true, replan_required: false, planned_start_date: null, planned_completion_date: "2026-10-27", shipping_date: "2026-11-07", on_time: true, buffer_days: 11, delay_days: 0 }), ["ETA: 27.10.2026", "Отгрузка: 07.11.2026", "Запас: 11 дней"]);
  assert.equal(planningEmptyLabel("all"), "Нет техкарт для ручного планирования.");
  assert.equal(planningEmptyLabel("overdue"), "Просроченных операций не найдено.");
  assert.equal(planningEmptyLabel("risk"), "Техкарт с риском срока нет.");
  assert.equal(planningEmptyLabel("replan"), "Нет техкарт, требующих перепланирования.");
  assert.equal(planningEmptyLabel("clear"), "Нет техкарт с актуальным планом.");
  assert.equal(routeStateLabel("completed"), "Завершена");
  assert.equal(routeStateLabel("in_progress"), "В работе");
  assert.equal(routeStateLabel("pending"), "Запланирована");
  const helper = readFileSync(join(root, "manual-planning.ts"), "utf8");
  assert.equal(helper.includes("planned_date <"), false);
  assert.equal(helper.includes("overdueDays"), false);
});

test("route locks completed and in-progress steps and leaves only a future operation editable", () => {
  const route = buildPlanningRoute(stages, [
    assignment({ id: 30, snapshot_node_id: 3, operation_state: "future", operation_status: "pending", planned_date: "2026-10-21" }),
    assignment({ id: 31, snapshot_node_id: 2, operation_state: "current", operation_status: "in_progress" }),
  ]);
  assert.deepEqual(route.map((step) => routeMarker(step.marker)), ["✓", "●", "○"]);
  assert.deepEqual(route.map((step) => step.locked), [true, true, false]);
  assert.equal(route[2].assignmentId, 30);
  assert.equal(route[2].planDate, "2026-10-21");
  assert.equal(route[1].assignmentId, null);
  const currentPending = buildPlanningRoute(
    [{ id: 2, stage_order: 1, stage_label: "Пошив", operation_name: "Пошив", status: "pending", production_stage_id: 4 }],
    [assignment({ id: 40, snapshot_node_id: 2, operation_state: "current", operation_status: "pending" })],
  );
  assert.equal(routeMarker(currentPending[0].marker), "●");
  assert.equal(currentPending[0].locked, true);
  assert.equal(currentPending[0].assignmentId, null);
});

const token = "a".repeat(64);
const fingerprint = "b".repeat(64);

function previewPayload(patch = {}) {
  return {
    technical_card_id: 162,
    snapshot_node_id: 30,
    target_date: "2026-10-17",
    mode: "downstream",
    revision: token,
    preview_fingerprint: fingerprint,
    apply_allowed: true,
    old_selected_start: "2026-10-16",
    new_selected_start: "2026-10-17",
    selected_operation: {
      snapshot_node_id: 30,
      operation_name: "Раскрой",
      old_start: "2026-10-16",
      new_start: "2026-10-17",
      reason: "selected_date",
    },
    affected_assignments: [
      { snapshot_node_id: 30, operation_name: "Раскрой", old_start: "2026-10-16", new_start: "2026-10-17", reason: "selected_date" },
      { snapshot_node_id: 31, operation_name: "Пошив", old_start: "2026-10-17", new_start: "2026-10-18", reason: "downstream_dependency" },
      { snapshot_node_id: 32, operation_name: "ВТО", old_start: "2026-10-18", new_start: "2026-10-19", reason: "downstream_dependency" },
    ],
    old_eta: "2026-10-20",
    new_eta: "2026-10-21",
    shipping_date: "2026-11-01",
    old_slack: 12,
    new_slack: 11,
    risk_before: "on_time",
    risk_after: "late",
    capacity_warnings: [{ code: "manual_replan_shipping_risk", message: "Отгрузка под риском." }],
    dependency_warnings: [],
    blockers: [],
    ...patch,
  };
}

test("preview payload maps single and downstream without local dates", () => {
  const single = replanPreviewBody({ technicalCardId: 162, snapshotNodeId: 30, targetDate: "2026-10-17", mode: "single" });
  assert.deepEqual(single, { technical_card_id: 162, snapshot_node_id: 30, target_date: "2026-10-17", mode: "single" });
  const downstream = replanPreviewBody({ technicalCardId: 162, snapshotNodeId: 30, targetDate: "2026-10-17", mode: "downstream" });
  const preview = readReplanPreview(previewPayload());
  assert.ok(preview);
  assert.deepEqual(replanApplyBody(preview, downstream), { ...downstream, revision: token, preview_fingerprint: fingerprint });
  assert.equal("planned_date" in single, false);
  assert.equal(preview.new_eta, "2026-10-21");
  assert.equal(preview.new_slack, 11);
});

test("preview renders server dates, affected nodes, ETA, slack and risk", () => {
  const preview = readReplanPreview(previewPayload());
  assert.equal(replanSelectedLine(preview, "Раскрой"), "Раскрой: 16.10.2026 → 17.10.2026");
  assert.deepEqual(replanDownstreamLines(preview), ["Пошив 17.10.2026 → 18.10.2026", "ВТО 18.10.2026 → 19.10.2026"]);
  assert.equal(replanSlackLabel(preview.old_slack) + " → " + replanSlackLabel(preview.new_slack), "12 дн. → 11 дн.");
  assert.equal(replanRiskLabel(preview.risk_before) + " → " + replanRiskLabel(preview.risk_after), "В срок → Риск срока");
  assert.equal(preview.capacity_warnings[0].message, "Отгрузка под риском.");
  assert.equal("code" in preview.capacity_warnings[0], false);
  const blocked = readReplanPreview(previewPayload({ mode: "single", apply_allowed: false, blockers: [{ code: "manual_replan_dependency", message: "Дата раньше предыдущей операции." }] }));
  assert.equal(blocked.mode, "single");
  assert.equal(blocked.apply_allowed, false);
  assert.equal(blocked.blockers[0].message, "Дата раньше предыдущей операции.");
  assert.equal(readReplanPreview(previewPayload({ new_eta: "tomorrow" })), null);
});

test("apply stays disabled until the preview matches the form", () => {
  const preview = readReplanPreview(previewPayload());
  const form = { snapshotNodeId: 30, targetDate: "2026-10-17", mode: "downstream" };
  assert.equal(canApplyReplan(null, form), false);
  assert.equal(canApplyReplan(preview, form), true);
  assert.equal(canApplyReplan(preview, { ...form, targetDate: "2026-10-18" }), false);
  assert.equal(canApplyReplan(preview, { ...form, mode: "single" }), false);
  assert.equal(canApplyReplan(preview, { ...form, snapshotNodeId: 31 }), false);
  assert.equal(canApplyReplan(readReplanPreview(previewPayload({ apply_allowed: false })), form), false);
  assert.equal(canApplyReplan(readReplanPreview(previewPayload({ preview_fingerprint: "" })), form), false);
});

test("conflict codes become manager text and stale drops the preview", () => {
  assert.equal(readReplanConflict({ detail: { message: "raw", diagnostic: { code: "manual_replan_changed", message: "raw" } } }, null).message, REPLAN_CHANGED);
  assert.equal(readReplanConflict({ detail: { diagnostic: { code: "manual_replan_changed" } } }, "manual_replan_changed").stale, true);
  assert.equal(readReplanConflict({ detail: { diagnostic: { code: "manual_replan_protected", message: "code" } } }, null).message, REPLAN_PROTECTED);
  assert.equal(readReplanConflict({ detail: { diagnostic: { code: "manual_replan_dependency" } } }, null).message, REPLAN_DEPENDENCY);
  assert.equal(readReplanConflict({ detail: { diagnostic: { code: "manual_replan_capacity" } } }, null).message, REPLAN_CAPACITY);
  assert.equal(readReplanConflict({ detail: { message: "Маршрут ещё не готов.", diagnostic: { code: "manual_replan_blocked", message: "ignored" } } }, null).message, "Маршрут ещё не готов.");
  assert.equal(REPLAN_DOWNSTREAM_HINT.includes("Эту и последующие"), true);
});

test("manual planning screen uses preview and apply and locks factual steps", () => {
  const view = readFileSync(join(root, "../../components/production/calendar-manual-scheduling.tsx"), "utf8");
  const helper = readFileSync(join(root, "manual-planning.ts"), "utf8");
  assert.ok(view.includes("lg:grid-cols-[minmax(22rem,42%)_minmax(0,1fr)]"));
  assert.ok(view.includes("max-lg:hidden"));
  assert.ok(view.includes("data-planning-route"));
  assert.ok(view.includes("data-planning-card"));
  assert.ok(view.includes("data-planning-preview"));
  assert.ok(view.includes("Только эту операцию"));
  assert.ok(view.includes("Эту и последующие"));
  assert.ok(view.includes("План обновлён"));
  assert.ok(view.includes("router.refresh"));
  assert.ok(view.includes("fetchManualPlanningCards"));
  assert.ok(view.includes("Состояние плана"));
  assert.ok(view.includes("data-planning-empty"));
  assert.ok(view.includes("data-planning-summary"));
  assert.ok(view.includes("grid-cols-2"));
  assert.equal(view.includes("PLANNING_OVERDUE_GAP"), false);
  assert.equal(view.includes("Список не показывает просрочку"), false);
  assert.ok(view.includes("fetchPlanningHealth"));
  assert.ok(view.includes("can_replan"));
  const health = readFileSync(join(root, "planning-health.ts"), "utf8");
  assert.ok(health.includes("Просрочена"));
  assert.ok(view.includes("Что изменится"));
  assert.ok(view.includes("Выберите техкарту слева"));
  assert.ok(view.includes("data-planning-counts"));
  assert.ok(view.includes("Проверить перенос"));
  assert.ok(view.includes("Применить перенос"));
  assert.ok(view.includes("planningAttentionLine"));
  assert.ok(view.includes("Изменить дату готовности"));
  assert.ok(view.includes("data-planning-move-modal"));
  assert.ok(view.includes("TechnicalCardFullCardModal"));
  assert.ok(view.includes("Открыть ТК"));
  assert.ok(view.includes("operationHealthStatus"));
  assert.ok(view.includes(FACT_STEP_LABEL) || view.includes("FACT_STEP_LABEL"));
  assert.equal(view.includes('method: "PUT"'), false);
  assert.equal(view.includes("MOVE_BACKEND_GAP"), false);
  assert.ok(view.includes("/api/technical-cards?limit=500&offset="));
  assert.equal(view.includes("fetchTechnicalCards"), false);
  assert.equal(view.includes("127.0.0.1:8000"), false);
  assert.equal(view.includes("NEXT_PUBLIC_SPORT_LEADS_API_URL"), false);
  const proxy = readFileSync(join(root, "../../app/api/production-calendar/[...path]/route.ts"), "utf8");
  const listProxy = readFileSync(join(root, "../../app/api/technical-cards/route.ts"), "utf8");
  assert.ok(listProxy.includes("SPORT_LEADS_API_URL"));
  assert.ok(listProxy.includes("/technical-cards?limit="));
  assert.ok(listProxy.includes("Cookie"));
  assert.equal(listProxy.includes("NEXT_PUBLIC"), false);
  assert.ok(helper.includes("manual-planning/"));
  assert.ok(proxy.includes("manual-planning/cards"));
  assert.ok(proxy.includes("manual-planning/preview"));
  assert.ok(proxy.includes("manual-planning/apply"));
  assert.ok(proxy.includes("X-Diagnostic-Code"));
  assert.ok(view.includes('postManualReplan("preview"'));
  assert.ok(view.includes('postManualReplan("apply"'));
  assert.equal(helper.includes("MOVE_BACKEND_GAP"), false);
  assert.equal(helper.includes("old_slack -"), false);
  assert.equal(helper.includes("new_eta +"), false);
});
