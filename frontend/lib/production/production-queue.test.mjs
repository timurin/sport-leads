import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  QUEUE_ACTION_LABEL,
  QUEUE_PENDING_LABEL,
  canRunQueueSchedule,
  compareQueueCards,
  planningModeLabel,
  priorityPatch,
  queueCalendarRefreshPaths,
  queueDeviationLines,
  queueModeCaption,
  queueResultStatus,
  queueSchedulePath,
  queueSummaryText,
  shouldRefreshCalendar,
} from "./production-queue.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("mass schedule CTA posts the queue endpoint and shows the loading label", () => {
  assert.equal(queueSchedulePath(), "/production-calendar/schedule");
  assert.equal(QUEUE_ACTION_LABEL, "Пересчитать производственный план");
  assert.equal(QUEUE_PENDING_LABEL, "Пересчитываем...");
  const api = readFileSync(join(root, "lib/sales/order-tech-cards-api.ts"), "utf8");
  assert.match(api, /\/production-calendar\/schedule/);
  const view = readFileSync(join(root, "components/production/production-queue-panel.tsx"), "utf8");
  assert.ok(view.includes("scheduleProductionQueueAction"));
  assert.ok(view.includes("QUEUE_PENDING_LABEL"));
  assert.ok(view.includes("data-queue-schedule-cta"));
  const board = readFileSync(join(root, "components/production/calendar-weekly-board.tsx"), "utf8");
  assert.ok(board.includes("ProductionQueueSection"));
  assert.ok(!board.includes("title: \"Очередь\""));
});

test("summary and card status use backend counts and flags", () => {
  const planned = {
    status: "planned",
    total_cards: 2,
    planned_cards: 2,
    blocked_cards: 0,
    deadline_missed_cards: 0,
    preserved_cards: 1,
    results: [{ technical_card_id: 1, technical_card_number: "A", priority: 1, status: "planned", persisted: true, on_time: true, delay_days: 0 }],
  };
  assert.equal(queueSummaryText(planned), "Всего 2 · спланировано 2 · blocked 0 · риск срока 0 · сохранено 1");
  assert.equal(queueResultStatus({ result: planned.results[0] }), "planned");
  assert.equal(shouldRefreshCalendar(planned), true);
});

test("blocked and deadline-risk cards keep the backend reason", () => {
  const blocked = { status: "blocked", on_time: null, delay_days: null, deviations: [{ code: "manual_required", reason: "missing_cutting_mode" }] };
  assert.equal(queueResultStatus({ result: blocked }), "blocked");
  assert.deepEqual(queueDeviationLines(blocked.deviations), ["Нужен ручной ввод: missing_cutting_mode"]);
  const late = { status: "planned", on_time: false, delay_days: 2, deviations: [{ code: "deadline_missed", reason: "completion_after_shipping_date" }] };
  assert.equal(queueResultStatus({ result: late }), "риск срока");
  assert.match(queueDeviationLines(late.deviations)[0], /completion_after_shipping_date/);
  assert.equal(queueResultStatus({ planLocked: true, result: { status: "blocked", deviations: [{ code: "locked_assignment_conflict", reason: "plan_locked" }] } }), "locked");
});

test("priority save accepts null and does not schedule while edits are dirty", () => {
  assert.deepEqual(priorityPatch(""), { ok: true, priority: null });
  assert.deepEqual(priorityPatch("2"), { ok: true, priority: 2 });
  assert.equal(priorityPatch("0").ok, false);
  assert.equal(canRunQueueSchedule(1), false);
  assert.equal(canRunQueueSchedule(0), true);
  const view = readFileSync(join(root, "components/production/production-queue-panel.tsx"), "utf8");
  const edit = view.slice(view.indexOf("function editPriority"), view.indexOf("async function savePriorities"));
  assert.equal(edit.includes("scheduleProductionQueueAction"), false);
  assert.ok(view.includes("canRunQueueSchedule(dirtyCount)"));
  const actions = readFileSync(join(root, "app/(workspace)/production/calendar/queue-actions.ts"), "utf8");
  const save = actions.slice(actions.indexOf("export async function saveQueuePrioritiesAction"), actions.indexOf("export type QueueScheduleActionResult"));
  assert.equal(save.includes("scheduleProductionQueue"), false);
  assert.ok(save.includes("updateTechnicalCardPlanning"));
});

test("persisted queue refreshes calendar routes and an error leaves the board alone", () => {
  assert.deepEqual(queueCalendarRefreshPaths(), [
    "/production/calendar",
    "/production/calendar/planning",
    "/production/calendar/capacity",
  ]);
  assert.equal(shouldRefreshCalendar({ status: "blocked", results: [{ persisted: false }] }), false);
  assert.equal(shouldRefreshCalendar({ status: "empty", results: [] }), false);
  const view = readFileSync(join(root, "components/production/production-queue-panel.tsx"), "utf8");
  const run = view.slice(view.indexOf("async function runSchedule"), view.indexOf("const results"));
  assert.ok(run.indexOf("setError") < run.indexOf("shouldRefreshCalendar"));
  assert.ok(run.includes("if (shouldRefreshCalendar(result.schedule)) onRefresh();"));
  const board = readFileSync(join(root, "components/production/calendar-weekly-board.tsx"), "utf8");
  assert.ok(board.includes("assignmentRange"));
  assert.ok(board.includes("data-planning-mode"));
});

test("locked and manual marks stay visible and dates are not calculated", () => {
  assert.equal(planningModeLabel("auto"), "auto");
  assert.equal(planningModeLabel("manual_adjusted"), "manual_adjusted");
  assert.equal(planningModeLabel("locked", true), "locked");
  assert.equal(queueModeCaption({ planLocked: true }), "блок");
  assert.equal(queueModeCaption({ modes: ["manual_adjusted"] }), "ручная");
  assert.equal(queueModeCaption({ modes: ["auto"] }), "auto");
  const ordered = [
    { id: 2, number: "B", priority: null, shipping_date: "2026-10-01", planning_start_date: "2026-10-01", created_at: "2026-10-01T00:00:00Z" },
    { id: 1, number: "A", priority: 5, shipping_date: "2026-10-20", planning_start_date: "2026-10-08", created_at: "2026-10-01T00:00:00Z" },
  ].sort(compareQueueCards);
  assert.deepEqual(ordered.map((row) => row.id), [1, 2]);
  const source = readFileSync(join(root, "lib/production/production-queue.ts"), "utf8");
  assert.equal(source.includes("setDate"), false);
  assert.equal(source.includes("86400000"), false);
});
