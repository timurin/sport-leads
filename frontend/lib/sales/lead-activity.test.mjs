import assert from "node:assert/strict";
import test from "node:test";

import {
  filterLeadActivities,
  formatActivityDate,
  getMentionedUserIds,
  getNotePermissions,
  insertMention,
  sortLeadActivities,
} from "./lead-activity.ts";

const activities = [
  { id: "old", type: "lead_created", occurredAt: "2026-07-15T06:10:00.000Z", title: "old" },
  { id: "new-a", type: "comment_added", occurredAt: "2026-07-16T09:15:00.000Z", title: "new a" },
  { id: "new-b", type: "incoming_message", occurredAt: "2026-07-16T09:15:00.000Z", title: "new b", channel: "telegram" },
  { id: "file", type: "customer_updated", occurredAt: "invalid", title: "file", attachments: [{ id: "f", name: "a.pdf", mediaType: "PDF" }] },
];

test("sorts newest first and keeps equal timestamps stable", () => {
  assert.deepEqual(sortLeadActivities(activities).map((activity) => activity.id), ["new-a", "new-b", "old", "file"]);
});

test("filters comments, communications, tasks and attachments", () => {
  assert.deepEqual(filterLeadActivities(activities, "comments").map((activity) => activity.id), ["new-a"]);
  assert.deepEqual(filterLeadActivities(activities, "messages").map((activity) => activity.id), ["new-b"]);
  assert.deepEqual(filterLeadActivities(activities, "tasks"), []);
  assert.deepEqual(filterLeadActivities(activities, "files").map((activity) => activity.id), ["file"]);
});

test("formats dates with a stable Moscow timezone", () => {
  assert.equal(formatActivityDate("2026-07-16T09:15:00.000Z"), "16 июля 2026, 12:15");
  assert.equal(formatActivityDate("bad"), "Дата не указана");
});

test("enforces note ownership and detects mentions without duplicates", () => {
  const ownNote = { id: "note", type: "comment_added", occurredAt: "2026-07-16T09:15:00.000Z", title: "note", author: { id: "user-2", name: "Мария" } };
  assert.deepEqual(getNotePermissions(ownNote, "user-2"), { canEdit: true, canDelete: true, canPin: true });
  assert.deepEqual(getNotePermissions(ownNote, "user-1"), { canEdit: false, canDelete: false, canPin: true });
  assert.equal(getNotePermissions(activities[0], "user-2").canPin, false);

  const users = [{ id: "user-1", name: "Алексей Смирнов" }, { id: "user-2", name: "Мария Иванова" }];
  assert.equal(insertMention("Проверь", users[1]), "Проверь @Мария Иванова ");
  assert.equal(insertMention("@Мария Иванова проверь", users[1]), "@Мария Иванова проверь");
  assert.deepEqual(getMentionedUserIds("@Мария Иванова, проверь", users, ["user-2"]), ["user-2"]);
});
