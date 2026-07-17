import assert from "node:assert/strict";
import test from "node:test";

import {
  fromApiLeadCommercial,
  toApiLeadCommercialPayload,
  validateLeadCommercialCore,
} from "./lead-commercial-api.ts";

test("maps persisted commercial fields from the lead API", () => {
  assert.deepEqual(fromApiLeadCommercial({
    source: "website",
    sport: "Футбол",
    product_category: "Игровая форма",
    need_description: "Форма для команды",
    estimated_quantity: 25,
    estimated_amount: "250000.00",
    desired_date: "2026-09-15",
    city: "Казань",
  }), {
    source: "website",
    estimatedAmount: 250000,
    commercial: {
      sport: "Футбол",
      productCategory: "Игровая форма",
      needDescription: "Форма для команды",
      estimatedQuantity: 25,
      desiredReadyDate: "2026-09-15",
      deliveryCity: "Казань",
    },
  });
});

test("normalizes empty commercial values to explicit API nulls", () => {
  assert.deepEqual(toApiLeadCommercialPayload({
    source: " ",
    estimatedAmount: null,
  }), {
    source: null,
    sport: null,
    product_category: null,
    need_description: null,
    estimated_quantity: null,
    estimated_amount: null,
    desired_date: null,
    city: null,
  });
});

test("validates untrusted commercial mutation input", () => {
  assert.match(validateLeadCommercialCore(null), /формат/);
  assert.match(validateLeadCommercialCore({ source: null, estimatedAmount: 0, needDescription: null }), /текстовых/);
  assert.equal(validateLeadCommercialCore({ source: null, estimatedAmount: 0 }), undefined);
  assert.match(validateLeadCommercialCore({ source: null, estimatedAmount: -1 }), /Сумма/);
  assert.match(validateLeadCommercialCore({ source: null, estimatedAmount: 1_000_000_000_000 }), /Сумма/);
  assert.match(validateLeadCommercialCore({ source: null, estimatedAmount: 0, estimatedQuantity: 1.5 }), /Количество/);
  assert.match(validateLeadCommercialCore({ source: null, estimatedAmount: 0, desiredReadyDate: "2026-02-30" }), /Дата/);
});
