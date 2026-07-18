import assert from "node:assert/strict";
import test from "node:test";

import { fromApiLeadEvent } from "./lead-history.ts";

test("maps persisted lead events to timeline activities", () => {
  const activity = fromApiLeadEvent({
    id: 12,
    lead_id: 7,
    order_id: 31,
    event_type: "lead_converted",
    actor_id: 3,
    message: "Converted to order",
    created_at: "2026-07-18T10:00:00Z",
  });

  assert.deepEqual(activity, {
    id: "backend-event-12",
    type: "lead_closed",
    occurredAt: "2026-07-18T10:00:00Z",
    author: { id: "3", name: "Сотрудник #3" },
    title: "Лид конвертирован",
    description: "Converted to order",
    metadata: { orderId: 31 },
    isSystem: true,
  });
});

test("keeps persisted rejection and status events distinct", () => {
  assert.equal(fromApiLeadEvent({
    id: 1, lead_id: 7, order_id: null, event_type: "lead_status_changed",
    actor_id: null, message: "new -> contact", created_at: "2026-07-18T09:00:00Z",
  }).type, "status_changed");
  assert.equal(fromApiLeadEvent({
    id: 2, lead_id: 7, order_id: null, event_type: "lead_rejected",
    actor_id: null, message: "No budget", created_at: "2026-07-18T11:00:00Z",
  }).type, "lead_closed");
});
