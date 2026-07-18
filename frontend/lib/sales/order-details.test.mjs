import assert from "node:assert/strict";
import test from "node:test";

import { fromApiSalesOrder } from "./order-details.ts";

test("maps persisted order details and preserves nullable fields", () => {
  const order = fromApiSalesOrder({
    id: 41, number: "SO-2026-000041", lead_id: 9, client_id: 3, status: "new",
    responsible_id: null, responsible_name: null, client_name: null, title: "Форма для команды",
    description: null, product_category: null, sport: null, quantity: null, amount: null,
    desired_date: null, source: null, created_at: "2026-07-18T10:00:00Z", updated_at: "2026-07-18T10:00:00Z",
  });

  assert.equal(order.sourceLeadHref, "/sales/leads/9");
  assert.equal(order.clientName, "Клиент #3");
  assert.equal(order.responsibleName, "Не назначен");
  assert.equal(order.amount, "Не указана");
  assert.equal(order.description, "Описание пока не добавлено.");
  assert.equal(order.status, "Новый");
});
