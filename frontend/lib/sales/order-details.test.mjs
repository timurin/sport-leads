import assert from "node:assert/strict";
import test from "node:test";

import { fromApiSalesOrder, fromApiSalesOrderEvent } from "./order-details.ts";

test("maps persisted order details and preserves nullable fields", () => {
  const order = fromApiSalesOrder({
    id: 41, number: "SO-2026-000041", lead_id: 9, client_id: 3, organization_id: 2, organization_name: "ООО Спорт Лига", status: "new",
    responsible_id: null, responsible_name: null, client_name: null, title: "Форма для команды",
    description: null, product_category: null, sport: null, quantity: null, amount: null,
    desired_date: null, source: null, created_at: "2026-07-18T10:00:00Z", updated_at: "2026-07-18T10:00:00Z",
    items: [{ id: 7, order_id: 42, position: 1, snapshot_name: "Матчевка", size_range: "S-L", personalization: "Капитан", color: "Синий", unit: "шт", quantity: "2", unit_price: "1500", gross_amount: "3000", discount_percent: "10", discount_amount: "300", line_amount: "2700", created_at: "2026-07-18T10:00:00Z", updated_at: "2026-07-18T10:00:00Z" }],
  });

  assert.equal(order.sourceLeadHref, "/sales/leads/9");
  assert.equal(order.clientName, "Клиент #3");
  assert.equal(order.organizationName, "ООО Спорт Лига");
  assert.equal(order.items[0].grossAmount, "3 000,00 ₽");
  assert.equal(order.items[0].discountPercent, "10");
  assert.equal(order.items[0].discountAmount, "300,00 ₽");
  assert.equal(order.items[0].lineAmount, "2 700,00 ₽");
  assert.equal(order.items[0].sizeRange, "S-L");
  assert.equal(order.items[0].personalization, "Капитан");
  assert.equal(order.items[0].color, "Синий");
  assert.equal(order.responsibleName, "Не назначен");
  assert.equal(order.amount, "Не указана");
  assert.equal(order.description, "Описание пока не добавлено.");
  assert.equal(order.status, "Новый");
});

test("maps persisted order status history events", () => {
  const event = fromApiSalesOrderEvent({
    id: 7, event_type: "order_status_changed", actor_id: null,
    message: "Order status changed: new → production", created_at: "2026-07-18T10:05:00Z",
  });

  assert.equal(event.id, "order-event-7");
  assert.equal(event.title, "Статус заказа изменён");
  assert.equal(event.message, "Order status changed: new → production");
});
