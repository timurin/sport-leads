import assert from "node:assert/strict";
import test from "node:test";

import {
  fromApiLeadCommercial,
  toApiLeadCommercialPayload,
  validateLeadCommercialCore,
} from "./lead-commercial-api.ts";

test("maps all persisted commercial fields from the lead API", () => {
  assert.deepEqual(fromApiLeadCommercial({
    source: "website",
    direction: "Спортивная форма",
    sport: "Футбол",
    product_category: "Игровая форма",
    product_type: "Игровой комплект",
    need_description: "Форма для команды",
    estimated_quantity: 25,
    kit_quantity: 2,
    size_comment: "XS-XL",
    preliminary_budget: "230000.00",
    estimated_amount: "250000.00",
    discount_percent: "5.50",
    probability: "70.00",
    planned_order_date: "2026-09-01",
    desired_date: "2026-09-15",
    event_date: "2026-09-30",
    delivery_city: "Самара",
    city: "Казань",
    delivery_address: "ул. Спортивная, 1",
    delivery_method: "Курьер",
    delivery_comment: "После 18:00",
    campaign: "fall-teamwear",
    utm_description: "utm_source=vk",
    priority: "high",
  }), {
    source: "website",
    estimatedAmount: 250000,
    probability: 70,
    commercial: {
      direction: "Спортивная форма",
      sport: "Футбол",
      productCategory: "Игровая форма",
      productType: "Игровой комплект",
      needDescription: "Форма для команды",
      estimatedQuantity: 25,
      kitQuantity: 2,
      sizeComment: "XS-XL",
      preliminaryBudget: 230000,
      discountPercent: 5.5,
      plannedOrderDate: "2026-09-01",
      desiredReadyDate: "2026-09-15",
      eventDate: "2026-09-30",
      deliveryCity: "Самара",
      deliveryAddress: "ул. Спортивная, 1",
      deliveryMethod: "Курьер",
      deliveryComment: "После 18:00",
      campaign: "fall-teamwear",
      utmDescription: "utm_source=vk",
      priority: "high",
    },
  });
});

test("normalizes empty commercial values to explicit API nulls", () => {
  assert.deepEqual(toApiLeadCommercialPayload({
    source: " ",
    estimatedAmount: null,
  }), {
    source: null,
    direction: null,
    sport: null,
    product_category: null,
    product_type: null,
    need_description: null,
    estimated_quantity: null,
    kit_quantity: null,
    size_comment: null,
    preliminary_budget: null,
    estimated_amount: null,
    discount_percent: null,
    probability: null,
    planned_order_date: null,
    desired_date: null,
    event_date: null,
    delivery_city: null,
    delivery_address: null,
    delivery_method: null,
    delivery_comment: null,
    campaign: null,
    utm_description: null,
    priority: null,
  });
});

test("validates untrusted commercial mutation input", () => {
  assert.match(validateLeadCommercialCore(null), /формат/);
  assert.match(validateLeadCommercialCore({ source: null, estimatedAmount: 0, needDescription: null }), /текстовых/);
  assert.equal(validateLeadCommercialCore({ source: null, estimatedAmount: 0 }), undefined);
  assert.match(validateLeadCommercialCore({ source: null, estimatedAmount: -1 }), /Сумма/);
  assert.match(validateLeadCommercialCore({ source: null, estimatedAmount: 1_000_000_000_000 }), /Сумма/);
  assert.match(validateLeadCommercialCore({ source: null, estimatedAmount: 0, estimatedQuantity: 1.5 }), /Количество/);
  assert.match(validateLeadCommercialCore({ source: null, estimatedAmount: 0, kitQuantity: 1.5 }), /Количество комплектов/);
  assert.match(validateLeadCommercialCore({ source: null, estimatedAmount: 0, discountPercent: 101 }), /Процент/);
  assert.match(validateLeadCommercialCore({ source: null, estimatedAmount: 0, probability: -1 }), /Процент/);
  assert.match(validateLeadCommercialCore({ source: null, estimatedAmount: 0, desiredReadyDate: "2026-02-30" }), /Дата/);
  assert.match(validateLeadCommercialCore({ source: null, estimatedAmount: 0, priority: "blocked" }), /Приоритет/);
});
