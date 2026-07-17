import assert from "node:assert/strict";
import test from "node:test";

import {
  createTaskDueAt,
  getNearestLeadTask,
  getTaskTimingLabel,
  rescheduleTaskDueAt,
  sortLeadTasks,
} from "./lead-task.ts";

const user = { id: "user-1", name: "Алексей", initials: "А" };
const referenceAt = "2026-07-16T09:00:00.000Z";
const tasks = [
  { id: "future", leadId: "lead-1", title: "future", type: "call", status: "open", priority: "medium", assignedTo: user, dueAt: "2026-07-17T09:00:00.000Z", createdAt: referenceAt, createdBy: user },
  { id: "overdue", leadId: "lead-1", title: "overdue", type: "call", status: "open", priority: "high", assignedTo: user, dueAt: "2026-07-15T09:00:00.000Z", createdAt: referenceAt, createdBy: user },
  { id: "done-old", leadId: "lead-1", title: "done", type: "other", status: "completed", priority: "low", assignedTo: user, dueAt: referenceAt, createdAt: referenceAt, completedAt: "2026-07-15T10:00:00.000Z", createdBy: user },
  { id: "done-new", leadId: "lead-1", title: "done", type: "other", status: "completed", priority: "low", assignedTo: user, dueAt: referenceAt, createdAt: referenceAt, completedAt: "2026-07-16T10:00:00.000Z", createdBy: user },
];

test("sorts overdue and completed tasks and finds the nearest open task", () => {
  assert.deepEqual(sortLeadTasks(tasks, "open", referenceAt).map((task) => task.id), ["overdue", "future"]);
  assert.deepEqual(sortLeadTasks(tasks, "completed", referenceAt).map((task) => task.id), ["done-new", "done-old"]);
  assert.equal(getNearestLeadTask(tasks, referenceAt)?.id, "overdue");
});

test("creates stable Moscow ISO deadlines and validates impossible dates", () => {
  assert.equal(createTaskDueAt("2026-07-18", "12:00"), "2026-07-18T09:00:00.000Z");
  assert.equal(createTaskDueAt("2026-02-30", "12:00"), undefined);
  assert.equal(rescheduleTaskDueAt("2026-07-18T09:00:00.000Z", referenceAt, 3), "2026-07-19T09:00:00.000Z");
});

test("returns text timing labels", () => {
  assert.equal(getTaskTimingLabel(tasks[1], referenceAt), "Просрочено");
  assert.equal(getTaskTimingLabel(tasks[0], referenceAt), "Завтра");
  assert.equal(getTaskTimingLabel(tasks[2], referenceAt), "Завершено");
});
