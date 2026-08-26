import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.6 unified feed has no page tabs or composer; event modal is 50vw", () => {
  const page = readFileSync(join(root, "components/sales/lead-page.tsx"), "utf8");
  assert.ok(!page.includes('feedTab === "communication"'));
  assert.ok(!page.includes("LeadCommunicationPanel"));
  assert.ok(!page.includes("HostWorkTasksPanel"));
  assert.ok(!page.includes("Внутренняя переписка"));
  assert.ok(page.includes("unified"));
  assert.ok(page.includes("LeadEventModal"));
  assert.ok(page.includes('setEventModal({ kind: "compose" })'));
  assert.ok(page.includes("collaborationMessageToActivity"));
  assert.ok(page.includes('label: "Коммуникации"'));

  const timeline = readFileSync(join(root, "components/sales/lead-activity-timeline.tsx"), "utf8");
  assert.ok(timeline.includes('unified = false'));
  assert.ok(timeline.includes("filterLeadActivitiesByChannel"));
  assert.ok(timeline.includes('label: "Заметки"'));
  assert.ok(timeline.includes('label: "Системные"'));
  assert.ok(timeline.includes("activeFilter === \"messages\""));
  assert.ok(timeline.includes("activityOpensInEventModal"));
  assert.ok(timeline.includes('id: "internal"'));

  const modal = readFileSync(join(root, "components/sales/lead-event-modal.tsx"), "utf8");
  assert.ok(modal.includes("data-lead-event-modal"));
  assert.ok(modal.includes("w-[50vw]"));
  assert.ok(modal.includes("z-portal-modal-3"));
  assert.ok(modal.includes("stopImmediatePropagation"));
  assert.ok(modal.includes("data-lead-channel-thread"));
  assert.ok(modal.includes("buildLeadChannelThread"));
  assert.ok(page.includes("messages={lead.messages}"));
});
