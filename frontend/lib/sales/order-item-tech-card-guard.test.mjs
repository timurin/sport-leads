import assert from "node:assert/strict";
import test from "node:test";

import {
  blockingTechCardsForItemIds,
  formatDeleteBlockedByTechCardsMessage,
} from "./order-item-tech-card-guard.ts";

const rows = [
  {
    salesOrderItemId: 11,
    number: "TC-2026-000011",
    status: "in_progress",
    statusLabel: "В работе",
  },
  {
    salesOrderItemId: 12,
    number: "—",
    status: "missing",
    statusLabel: "Нет ТК",
  },
  {
    salesOrderItemId: 13,
    number: "TC-2026-000013",
    status: "draft",
    statusLabel: "Черновик",
  },
];

test("26.1.1 blocking cards skip missing rows and keep created/started TCs", () => {
  const blocking = blockingTechCardsForItemIds([11, 12, 13], rows);
  assert.deepEqual(
    blocking.map((row) => row.salesOrderItemId),
    [11, 13],
  );
  assert.equal(blocking[0].number, "TC-2026-000011");
  assert.equal(blocking[1].statusLabel, "Черновик");
});

test("26.1.1 empty selection has no blocking cards", () => {
  assert.deepEqual(blockingTechCardsForItemIds([12], rows), []);
  assert.equal(formatDeleteBlockedByTechCardsMessage([]), "");
});

test("26.1.1 message lists number and status and does not offer cascade", () => {
  const message = formatDeleteBlockedByTechCardsMessage(
    blockingTechCardsForItemIds([11, 13], rows),
  );
  assert.match(message, /TC-2026-000011 — В работе/);
  assert.match(message, /TC-2026-000013 — Черновик/);
  assert.match(message, /не удалены/i);
  assert.match(message, /Каскадное удаление/);
});
