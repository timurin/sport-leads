import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  calendarOperationStatusLabel,
  currentWorkshopStatusLabel,
} from "./production-state-label.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

test("calendar status belongs to the assignment snapshot node, not its workshop", () => {
  const shared = { operationState: "current", lifecycleStatus: "in_progress", workshopState: "in_progress" };
  assert.equal(calendarOperationStatusLabel({ ...shared, operationStatus: "in_progress" }), "В работе");
  assert.equal(calendarOperationStatusLabel({ ...shared, operationStatus: "pending" }), "Запланирована");
  assert.equal(calendarOperationStatusLabel({ ...shared, operationStatus: "completed" }), "Завершено");
});

test("current calendar row uses the kanban status and other rows stay plan or done", () => {
  assert.equal(currentWorkshopStatusLabel({ lifecycleStatus: "planned", workshopState: "waiting" }), "Запланирована");
  assert.equal(currentWorkshopStatusLabel({ lifecycleStatus: "in_progress", workshopState: "waiting" }), "Ожидает");
  assert.equal(currentWorkshopStatusLabel({ lifecycleStatus: "in_progress", workshopState: "in_progress" }), "В работе");
  assert.equal(calendarOperationStatusLabel({
    operationState: "current",
    lifecycleStatus: "planned",
    workshopState: "waiting",
  }), "Запланирована");
  assert.equal(calendarOperationStatusLabel({
    operationState: "current",
    lifecycleStatus: "in_progress",
    workshopState: "waiting",
  }), "Ожидает");
  assert.equal(calendarOperationStatusLabel({ operationState: "future", lifecycleStatus: "in_progress", workshopState: "waiting" }), "План");
  assert.equal(calendarOperationStatusLabel({ operationState: "completed", lifecycleStatus: "in_progress", workshopState: "waiting" }), "Завершено");
});

test("calendar card shows the current workshop instead of the clicked plan row", () => {
  const board = readFileSync(join(root, "frontend/components/production/calendar-weekly-board.tsx"), "utf8");
  assert.equal(board.includes("Текущая стадия"), false);
  assert.ok(board.includes("Текущий участок"));
  assert.ok(board.includes("calendarOperationStatusLabel"));
  assert.ok(board.includes("data-operation-state"));
});
