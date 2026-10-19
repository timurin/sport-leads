import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  calendarStatusCountLabel,
  calendarStatusFilterOptions,
  calendarStatusFilterSummary,
  filterCalendarAssignments,
  toggleCalendarStatus,
} from "./calendar-status-filter.ts";

const root = dirname(fileURLToPath(import.meta.url));
const rows = [
  { id: 1, operation_status: "pending", note: "plan" },
  { id: 2, operation_status: "in_progress", note: "work" },
  { id: 3, operation_status: "completed", note: "done" },
  { id: 4, operation_status: "skipped", note: "skip" },
  { id: 5, operation_status: null, note: "bare" },
];

test("default calendar status filter keeps every assignment", () => {
  const visible = filterCalendarAssignments(rows, []);
  assert.deepEqual(visible.map((item) => item.id), [1, 2, 3, 4, 5]);
  assert.equal(rows.length, 5);
  assert.equal(rows[0].note, "plan");
  assert.notEqual(visible, rows);
});

test("В работе shows only in_progress", () => {
  assert.deepEqual(filterCalendarAssignments(rows, ["in_progress"]).map((item) => item.id), [2]);
});

test("Завершена shows only completed", () => {
  assert.deepEqual(filterCalendarAssignments(rows, ["completed"]).map((item) => item.id), [3]);
});

test("multi-select keeps the chosen statuses and leaves the source list intact", () => {
  const selected = toggleCalendarStatus([], "pending", ["pending", "in_progress", "completed"]);
  const both = toggleCalendarStatus(selected, "in_progress", ["pending", "in_progress", "completed"]);
  const visible = filterCalendarAssignments(rows, both);
  assert.deepEqual(visible.map((item) => item.id), [1, 2]);
  assert.deepEqual(rows.map((item) => item.operation_status), ["pending", "in_progress", "completed", "skipped", null]);
});

test("empty status result is an empty list and does not invent assignments", () => {
  assert.deepEqual(filterCalendarAssignments(rows, ["missing"]), []);
  assert.deepEqual(filterCalendarAssignments([], ["in_progress"]), []);
});

test("extra canonical status uses the existing calendar label", () => {
  const options = calendarStatusFilterOptions(rows);
  assert.deepEqual(options.map((item) => item.label), ["Запланирована", "В работе", "Завершена", "Пропущена"]);
  assert.equal(calendarStatusFilterSummary([], options), "Все статусы");
  assert.equal(calendarStatusFilterSummary(["in_progress"], options), "В работе");
  assert.equal(calendarStatusFilterSummary(["pending", "in_progress"], options), "Запланирована + В работе");
  assert.equal(calendarStatusFilterSummary(["pending", "in_progress", "skipped"], options), calendarStatusCountLabel(3));
  assert.equal(calendarStatusCountLabel(2), "2 статуса");
});

test("calendar status filter is a wrapping toolbar control and does not reload the plan", () => {
  const board = readFileSync(join(root, "../../components/production/calendar-weekly-board.tsx"), "utf8");
  const control = readFileSync(join(root, "../../components/production/calendar-status-filter.tsx"), "utf8");
  assert.ok(board.includes("data-calendar-status-filter") || board.includes("<CalendarStatusFilter"));
  assert.ok(board.includes("filterCalendarAssignments"));
  assert.ok(board.includes("data-calendar-status-empty"));
  assert.ok(board.includes("<ProductionQueueSection assignments={board.assignments}"));
  assert.ok(board.includes("<QueueLoadProvider board={board}"));
  assert.ok(board.includes("}, [anchor, stage, revision]);"));
  assert.ok(control.includes("flex-wrap") || control.includes("sm:w-auto"));
  assert.ok(control.includes("Все"));
  assert.ok(control.includes("w-full"));
});
