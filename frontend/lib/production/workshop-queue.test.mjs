import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  WORKSHOP_QUEUE_APPLY_SUCCESS,
  WORKSHOP_QUEUE_STALE_MESSAGE,
  canApplyWorkshopQueue,
  cardFactLabel,
  moveQueueItem,
  presentQueueItems,
  readQueueConflict,
  readWorkshopQueue,
  replaceWorkshopQueue,
  sameNodeOrder,
  workshopQueueApplyBody,
  workshopQueueManagerMessage,
  workshopQueuePreviewBody,
} from "./workshop-queue.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const revision = "a".repeat(64);
const fingerprint = "b".repeat(64);

function payload(items) {
  return {
    workshop_id: 44,
    revision,
    items: items.map((item) => ({
      technical_card_id: item.id,
      technical_card_number: item.number,
      snapshot_node_id: item.node,
      workshop_id: 44,
      workshop_name: "Дизайн",
      operation_id: 7,
      operation_name: "Макет",
      queue_position: item.position,
      priority: item.priority,
      planned_start: "2026-10-20",
      planned_end: "2026-10-21",
      eta: "2026-10-22",
      shipping_date: "2026-10-25",
      risk: "on_time",
      status: "waiting",
      protected: item.protected === true,
      read_only: item.readOnly === true,
    })),
  };
}

test("GET queue keeps the server order and card facts do not reorder it", () => {
  const section = readWorkshopQueue(payload([
    { id: 2, number: "TK-2", node: 20, position: 1, priority: 9 },
    { id: 1, number: "TK-1", node: 10, position: 2, priority: 1 },
  ]));
  assert.ok(section);
  assert.deepEqual(section.items.map((row) => row.number), ["TK-2", "TK-1"]);
  const rows = presentQueueItems(section.items, new Map([
    [2, cardFactLabel({ product_model_article: "201.1", product_model_name: "Форма", quantity: "10" })],
  ]));
  assert.equal(rows[0].model, "201.1 · Форма");
  assert.equal(rows[0].quantity, "10");
  assert.equal(rows[1].quantity, "—");
  assert.deepEqual(rows.map((row) => row.snapshotNodeId), [20, 10]);
});

test("arrows change only the draft and a protected row cannot move", () => {
  const section = readWorkshopQueue(payload([
    { id: 1, number: "TK-1", node: 10, position: 1, priority: 1 },
    { id: 2, number: "TK-2", node: 20, position: 2, priority: 2 },
    { id: 3, number: "TK-3", node: 30, position: 3, priority: 3, protected: true },
  ]));
  const moved = moveQueueItem(section.items, 20, -1);
  assert.ok(moved);
  assert.deepEqual(moved.map((row) => row.snapshotNodeId), [20, 10, 30]);
  assert.deepEqual(section.items.map((row) => row.position), [1, 2, 3]);
  assert.equal(sameNodeOrder(moved, section.items), false);
  assert.equal(moveQueueItem(section.items, 30, -1), null);
  assert.equal(moveQueueItem(section.items, 99, -1), null);
});

test("preview and apply carry revision and fingerprint, and apply stays disabled until preview matches", () => {
  const section = readWorkshopQueue(payload([
    { id: 1, number: "TK-1", node: 10, position: 1, priority: 1 },
    { id: 2, number: "TK-2", node: 20, position: 2, priority: 2 },
  ]));
  const draft = moveQueueItem(section.items, 20, -1);
  const previewBody = workshopQueuePreviewBody(section.revision, draft);
  assert.deepEqual(previewBody.ordered_snapshot_node_ids, [20, 10]);
  assert.equal("preview_fingerprint" in previewBody, false);
  const preview = { canApply: true, fingerprint, workshopId: 44, revision, changes: [], warnings: [], blockers: [] };
  assert.equal(canApplyWorkshopQueue({
    canReorder: true, busy: false, preview: null, previewOrder: null, draft,
  }), false);
  assert.equal(canApplyWorkshopQueue({
    canReorder: true, busy: false, preview: { ...preview, canApply: false }, previewOrder: [20, 10], draft,
  }), false);
  assert.equal(canApplyWorkshopQueue({
    canReorder: true, busy: false, preview, previewOrder: [10, 20], draft,
  }), false);
  assert.equal(canApplyWorkshopQueue({
    canReorder: false, busy: false, preview, previewOrder: [20, 10], draft,
  }), false);
  assert.equal(canApplyWorkshopQueue({
    canReorder: true, busy: false, preview, previewOrder: [20, 10], draft,
  }), true);
  assert.equal(workshopQueueApplyBody(revision, draft, fingerprint).preview_fingerprint, fingerprint);
});

test("stale 409 and queue errors use manager text, then success replaces that workshop", () => {
  const stale = readQueueConflict({
    detail: {
      message: "Очередь или производственный план изменились. Выполните новый предпросмотр.",
      diagnostic: { code: "workshop_queue_changed", message: "technical" },
    },
  }, "workshop_queue_changed");
  assert.equal(stale.stale, true);
  assert.equal(stale.message, WORKSHOP_QUEUE_STALE_MESSAGE);
  assert.equal(workshopQueueManagerMessage("queue_item_not_waiting", null).includes("queue_item_not_waiting"), false);
  assert.equal(workshopQueueManagerMessage("queue_cross_workshop_reorder", null), "Можно менять порядок работ только одного участка.");
  assert.equal(workshopQueueManagerMessage("queue_contains_protected_fact", null), "Начатые, завершённые или закреплённые работы менять нельзя.");
  assert.equal(workshopQueueManagerMessage("queue_replan_failed", null), "Не удалось безопасно пересчитать план. Проверьте причины и повторите предпросмотр.");
  const current = readWorkshopQueue(payload([{ id: 1, number: "TK-1", node: 10, position: 1, priority: 1 }]));
  const other = { ...current, workshopId: 55, items: current.items.map((item) => ({ ...item, workshopId: 55 })) };
  const next = readWorkshopQueue(payload([
    { id: 2, number: "TK-2", node: 20, position: 1, priority: 2 },
  ]));
  const replaced = replaceWorkshopQueue([current, other], next);
  assert.equal(replaced.find((section) => section.workshopId === 44).items[0].number, "TK-2");
  assert.equal(replaced.find((section) => section.workshopId === 55).items[0].workshopId, 55);
  assert.equal(WORKSHOP_QUEUE_APPLY_SUCCESS.includes("календар"), true);
});

test("queue screen calls the backend and leaves kanban fact untouched", () => {
  const panel = readFileSync(join(root, "frontend/components/production/workshop-queue-panel.tsx"), "utf8");
  const actions = readFileSync(join(root, "frontend/app/(workspace)/production/tech-cards/workshop-queue-actions.ts"), "utf8");
  const page = readFileSync(join(root, "frontend/app/(workspace)/production/tech-cards/page.tsx"), "utf8");
  const kanban = readFileSync(join(root, "frontend/components/production/shop-stage-kanban-workspace.tsx"), "utf8");
  assert.ok(panel.includes("Предпросмотр"));
  assert.ok(panel.includes("Применить очередь"));
  assert.ok(panel.includes("Обновить очередь"));
  assert.ok(panel.includes("disabled={!applyAllowed}"));
  assert.ok(panel.includes("previewWorkshopQueueAction"));
  assert.ok(panel.includes("applyWorkshopQueueAction"));
  assert.equal(panel.includes("WORKSHOP_QUEUE_REORDER_GAP"), false);
  assert.equal(panel.includes("waitingWorkshopQueue"), false);
  assert.ok(actions.includes("calendarPathsAfterSchedule"));
  assert.ok(actions.includes("revalidatePath"));
  assert.ok(page.includes("loadWorkshopQueues"));
  assert.ok(page.includes("PERM_TECHNICAL_CARDS_CREATE"));
  assert.equal(page.includes("workshop_queue.write"), false);
  assert.ok(kanban.includes("dragEnabled={false}"));
  assert.equal(kanban.includes("applyWorkshopQueueAction"), false);
});
