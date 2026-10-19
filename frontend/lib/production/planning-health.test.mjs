import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  earliestOverdueText,
  filterPlanningHealth,
  matchesPlanningAttention,
  operationHealthStatus,
  operationPlanLabel,
  parseManualPlanningCardList,
  parsePlanningHealth,
  planningAttentionLine,
  planningHealthBadge,
  planningHealthCounts,
  planningHealthEmpty,
  planningHealthSummaryLines,
  planningProgressText,
  sharedHealthFacts,
} from "./planning-health.ts";

function summary(patch = {}) {
  return {
    technical_card_id: 163,
    planning_date: "2026-10-17",
    planning_state: "actual",
    replan_required: true,
    eta: "2026-10-30",
    shipping_date: "2026-11-06",
    slack_days: 7,
    on_time: true,
    risk_level: "on_time",
    current_workshop_id: 1,
    current_workshop_name: "Дизайн",
    route_total_operations: 7,
    completed_operations: 0,
    in_progress_operations: 0,
    pending_operations: 7,
    has_overdue_operations: true,
    overdue_operation_count: 5,
    earliest_overdue_operation: "Дизайн",
    earliest_overdue_snapshot_node_id: 1168,
    earliest_overdue_workshop: "Дизайн",
    earliest_overdue_date: "2026-10-14",
    overdue_days: 3,
    next_operation: "Сублимационная печать",
    next_snapshot_node_id: 1169,
    next_operation_date: "2026-10-14",
    has_planning_issues: true,
    ...patch,
  };
}

function operation(patch = {}) {
  return {
    snapshot_node_id: 1168,
    operation_name: "Дизайн",
    workshop_id: 1,
    workshop_name: "Дизайн",
    operation_status: "pending",
    planned_start: "2026-10-14",
    planned_end: "2026-10-14",
    is_overdue: true,
    overdue_days: 3,
    is_protected: false,
    can_replan: true,
    warning_code: null,
    ...patch,
  };
}

const filters = { search: "", stageId: null, attention: "all", shippingDate: "" };

test("list and detail map the same planning health summary", () => {
  const list = parseManualPlanningCardList([{ ...summary(), number: "PC063D-OVERDUE-20261016-1" }]);
  const detail = parsePlanningHealth({ ...summary(), operations: [operation(), operation({ snapshot_node_id: 1173, operation_name: "ВТО", is_overdue: false, overdue_days: 0, planned_start: "2026-10-30", planned_end: "2026-10-30" })] });
  assert.ok(list);
  assert.ok(detail);
  assert.equal(list[0].number, "PC063D-OVERDUE-20261016-1");
  assert.deepEqual(sharedHealthFacts(list[0]), sharedHealthFacts(detail));
  assert.equal(planningProgressText(list[0]), planningProgressText(detail));
  assert.equal(earliestOverdueText(list[0]), "Дизайн · Дизайн · 14.10.2026 · 3 дня");
  assert.deepEqual(planningHealthSummaryLines(list[0]), planningHealthSummaryLines(detail));
  assert.equal(parseManualPlanningCardList([{ ...summary(), number: "A", operations: [] }]), null);
  assert.equal(parsePlanningHealth(summary()), null);
});

test("badges follow overdue, risk, replan, then a healthy plan", () => {
  const overdue = summary();
  assert.equal(planningHealthBadge(overdue, "list").label, "Просрочена на 3 дня");
  assert.equal(planningHealthBadge(overdue, "card").label, "Просрочено операций: 5");
  const late = summary({ has_overdue_operations: false, overdue_operation_count: 0, overdue_days: 0, earliest_overdue_operation: null, earliest_overdue_workshop: null, earliest_overdue_date: null, earliest_overdue_snapshot_node_id: null, risk_level: "late", on_time: false, replan_required: true });
  assert.equal(planningHealthBadge(late, "list").label, "Риск срока");
  const replan = summary({ has_overdue_operations: false, overdue_operation_count: 0, overdue_days: 0, earliest_overdue_operation: null, earliest_overdue_date: null, risk_level: "on_time", replan_required: true, planning_state: "stale" });
  assert.equal(planningHealthBadge(replan, "card").label, "Требует перепланирования");
  const healthy = summary({ has_overdue_operations: false, overdue_operation_count: 0, overdue_days: 0, earliest_overdue_operation: null, earliest_overdue_date: null, risk_level: "on_time", replan_required: false, has_planning_issues: false, planning_state: "actual" });
  assert.equal(planningHealthBadge(healthy, "list").label, "План актуален");
  const empty = summary({ planning_state: "not_planned", replan_required: false, has_overdue_operations: false, overdue_operation_count: 0, overdue_days: 0, risk_level: "unknown", has_planning_issues: true, eta: null, slack_days: null });
  assert.equal(planningHealthBadge(empty, "card").label, "План не рассчитан");
  assert.equal(planningAttentionLine(overdue, "card"), "Просрочена операция «Дизайн» на 3 дня.");
  assert.equal(planningAttentionLine(overdue, "list"), "Просрочена операция «Дизайн» на 3 дня. Всего 5.");
  assert.equal(planningAttentionLine(summary({ ...overdue, overdue_operation_count: 1 }), "list"), "Просрочена операция «Дизайн» на 3 дня.");
  assert.equal(planningAttentionLine(late), "Риск срока.");
  assert.equal(planningAttentionLine(replan), "Требует перепланирования.");
  assert.equal(planningAttentionLine(healthy), null);
});

test("filters and empty states use canonical flags", () => {
  const overdue = { ...summary(), number: "163" };
  const late = { ...summary({ has_overdue_operations: false, overdue_operation_count: 0, overdue_days: 0, risk_level: "late", replan_required: false, technical_card_id: 10 }), number: "10" };
  const replan = { ...summary({ has_overdue_operations: false, overdue_operation_count: 0, overdue_days: 0, risk_level: "on_time", replan_required: true, technical_card_id: 11, has_planning_issues: true }), number: "11" };
  const healthy = { ...summary({ has_overdue_operations: false, overdue_operation_count: 0, overdue_days: 0, risk_level: "on_time", replan_required: false, has_planning_issues: false, technical_card_id: 12 }), number: "12" };
  const cards = [overdue, late, replan, healthy];
  assert.deepEqual(filterPlanningHealth(cards, new Map(), { ...filters, attention: "overdue" }).map((card) => card.technical_card_id), [163]);
  assert.deepEqual(filterPlanningHealth(cards, new Map(), { ...filters, attention: "risk" }).map((card) => card.technical_card_id), [10]);
  assert.deepEqual(filterPlanningHealth(cards, new Map(), { ...filters, attention: "replan" }).map((card) => card.technical_card_id), [163, 11]);
  assert.deepEqual(filterPlanningHealth(cards, new Map(), { ...filters, attention: "clear" }).map((card) => card.technical_card_id), [12]);
  assert.equal(matchesPlanningAttention(healthy, "clear"), true);
  assert.deepEqual(planningHealthCounts(cards), { overdue: 1, risk: 1, replan: 2 });
  assert.equal(planningHealthEmpty("all"), "Нет техкарт для ручного планирования.");
  assert.equal(planningHealthEmpty("overdue"), "Просроченных операций не найдено.");
  assert.equal(planningHealthEmpty("risk"), "Техкарт с риском срока нет.");
  assert.equal(planningHealthEmpty("replan"), "Нет техкарт, требующих перепланирования.");
  assert.equal(planningHealthEmpty("clear"), "Нет техкарт с актуальным планом.");
});

test("operation status uses the server overdue flag and ignores the planned date", () => {
  assert.equal(operationHealthStatus(operation()), "Просрочена");
  assert.equal(operationHealthStatus(operation({ is_overdue: false, planned_start: "2020-01-01" })), "Запланирована");
  assert.equal(operationHealthStatus(operation({ operation_status: "completed", is_overdue: true })), "Завершена");
  assert.equal(operationHealthStatus(operation({ operation_status: "in_progress", is_overdue: false })), "В работе");
  assert.equal(operationPlanLabel(operation()), "14.10.2026");
  assert.equal(operationPlanLabel(operation({ planned_start: "2026-10-18", planned_end: "2026-10-19", is_overdue: false })), "18.10.2026–19.10.2026");
  const source = readFileSync(new URL("./planning-health.ts", import.meta.url), "utf8");
  assert.equal(source.includes("planned_start <"), false);
  assert.equal(source.includes("Date.now"), false);
  assert.equal(source.includes("getTime"), false);
  assert.equal(source.includes("86400000"), false);
});
