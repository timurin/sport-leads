import assert from "node:assert/strict";
import test from "node:test";

import { fromApiSalesOrder, fromApiSalesOrderEvent } from "./order-details.ts";

test("maps persisted order details and preserves nullable fields", () => {
  const order = fromApiSalesOrder({
    id: 41,
    number: "SO-2026-000041",
    lead_id: 9,
    client_id: 3,
    organization_id: 2,
    organization_name: "ООО Спорт Лига",
    status: "new",
    responsible_id: null,
    responsible_name: null,
    client_name: null,
    title: "Форма для команды",
    description: null,
    product_category: null,
    sport: null,
    quantity: null,
    amount: null,
    desired_date: null,
    source: null,
    created_at: "2026-07-18T10:00:00Z",
    updated_at: "2026-07-18T10:00:00Z",
    items: [{
      id: 7,
      order_id: 42,
      nomenclature_id: null,
      nomenclature_variant_id: null,
      product_model_id: null,
      product_model_article: null,
      product_model_name: null,
      product_model_size_type: null,
      assembly_variant_id: null,
      assembly_variant_name: null,
      assembly_variant_total_cost: null,
      routing_template_id: null,
      routing_template_name: null,
      vat_rate_id: null,
      vat_rate_percent: null,
      variant_snapshots: [],
      position: 1,
      snapshot_name: "Матчевка",
      size_range: "S-L",
      personalization: "Капитан",
      color: "Синий",
      unit: "шт",
      quantity: "2",
      unit_price: "1500",
      gross_amount: "3000",
      discount_percent: "10",
      discount_amount: "300",
      line_amount: "2700",
      created_at: "2026-07-18T10:00:00Z",
      updated_at: "2026-07-18T10:00:00Z",
    }],
  });

  assert.equal(order.sourceLeadHref, "/sales/leads/9");
  assert.equal(order.leadId, "9");
  assert.equal(order.clientId, "3");
  assert.equal(order.clientHref, "/sales/clients");
  assert.equal(order.organizationId, "2");
  assert.equal(order.organizationHref, "/settings/organizations");
  assert.equal(order.responsibleId, null);
  assert.equal(order.statusCode, "new");
  assert.equal(order.clientName, "Клиент #3");
  assert.equal(order.organizationName, "ООО Спорт Лига");
  assert.equal(order.items[0].grossAmount, "3 000,00 ₽");
  assert.equal(order.items[0].discountPercent, "10");
  assert.equal(order.items[0].discountAmount, "300,00 ₽");
  assert.equal(order.items[0].lineAmount, "2 700,00 ₽");
  assert.equal(order.items[0].unitPriceValue, "1500");
  assert.equal(order.items[0].lineAmountValue, "2700");
  assert.equal(order.items[0].vatRateId, null);
  assert.equal(order.items[0].productModelId, null);
  assert.equal(order.items[0].productModelSizeType, "");
  assert.equal(order.items[0].assemblyVariantId, null);
  assert.equal(order.items[0].assemblyVariantName, "");
  assert.equal(order.items[0].assemblyVariantTotalCost, "");
  assert.equal(order.items[0].routingTemplateId, null);
  assert.equal(order.items[0].routingTemplateName, "");
  assert.equal(order.items[0].sizeRange, "S-L");
  assert.equal(order.items[0].personalization, "Капитан");
  assert.equal(order.items[0].color, "Синий");
  assert.equal(order.responsibleName, "Не назначен");
  assert.equal(order.amount, "Не указана");
  assert.equal(order.amountValue, "");
  assert.equal(order.currencyCode, "RUB");
  assert.equal(order.itemsSubtotalValue, "2700");
  assert.equal(order.discountPercent, "");
  assert.equal(order.discountAmountValue, "0");
  assert.equal(order.description, "Описание пока не добавлено.");
  assert.equal(order.status, "Новый");
  assert.equal(order.itemCount, 1);
});

test("maps assembly variant, routing, and size_type snapshots on order items", () => {
  const order = fromApiSalesOrder({
    id: 42,
    number: "SO-2026-000042",
    lead_id: 9,
    client_id: 3,
    organization_id: 2,
    organization_name: "ООО Спорт Лига",
    status: "new",
    responsible_id: null,
    responsible_name: null,
    client_name: "Клиент",
    title: "Форма",
    description: null,
    product_category: null,
    sport: null,
    quantity: null,
    amount: "1000",
    desired_date: null,
    source: null,
    created_at: "2026-07-18T10:00:00Z",
    updated_at: "2026-07-18T10:00:00Z",
    items: [{
      id: 8,
      order_id: 42,
      nomenclature_id: 1,
      nomenclature_variant_id: null,
      product_model_id: 5,
      product_model_article: "213",
      product_model_name: "Футболка",
      product_model_size_type: "men",
      assembly_variant_id: 11,
      assembly_variant_name: "С отстрочкой",
      assembly_variant_total_cost: "450.00",
      routing_template_id: 3,
      routing_template_name: "Маршрут A",
      vat_rate_id: null,
      vat_rate_percent: null,
      variant_snapshots: [],
      position: 1,
      snapshot_name: "Футболка",
      size_range: null,
      personalization: null,
      color: null,
      unit: "шт",
      quantity: "1",
      unit_price: "1000",
      gross_amount: "1000",
      discount_percent: null,
      discount_amount: "0",
      line_amount: "1000",
      created_at: "2026-07-18T10:00:00Z",
      updated_at: "2026-07-18T10:00:00Z",
    }],
  });

  assert.equal(order.items[0].productModelId, 5);
  assert.equal(order.items[0].productModelSizeType, "men");
  assert.equal(order.items[0].assemblyVariantId, 11);
  assert.equal(order.items[0].assemblyVariantName, "С отстрочкой");
  assert.equal(order.items[0].assemblyVariantTotalCost, "450.00");
  assert.equal(order.items[0].routingTemplateId, 3);
  assert.equal(order.items[0].routingTemplateName, "Маршрут A");
});

test("maps lead and order history events through shared activity mapping", () => {
  const statusEvent = fromApiSalesOrderEvent({
    id: 7,
    lead_id: 9,
    order_id: 41,
    event_type: "order_status_changed",
    actor_id: null,
    message: "Order status changed: new → production",
    created_at: "2026-07-18T10:05:00Z",
  });
  assert.equal(statusEvent.id, "backend-event-7");
  assert.equal(statusEvent.title, "Статус заказа изменён");
  assert.equal(statusEvent.message, "Order status changed: new → production");

  const leadEvent = fromApiSalesOrderEvent({
    id: 3,
    lead_id: 9,
    order_id: null,
    event_type: "lead_created",
    actor_id: 2,
    message: "Lead created",
    created_at: "2026-07-17T09:00:00Z",
  });
  assert.equal(leadEvent.id, "backend-event-3");
  assert.equal(leadEvent.title, "Лид создан");
  assert.equal(leadEvent.message, "Lead created");
});
