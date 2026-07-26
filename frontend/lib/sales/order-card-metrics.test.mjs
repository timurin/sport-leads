import assert from "node:assert/strict";
import test from "node:test";

import { buildOrderCardMetrics } from "./order-card-metrics.ts";

const baseOrder = {
  id: "41",
  number: "SO-2026-000041",
  title: "Форма",
  status: "Новый",
  statusCode: "new",
  leadId: "9",
  clientId: "3",
  clientName: "Клиент",
  organizationId: "2",
  organizationName: "Организация",
  responsibleId: null,
  responsibleName: "Не назначен",
  amount: "Не указана",
  createdAt: "18 июля 2026 г.",
  createdAtIso: "2026-07-18T10:00:00Z",
  updatedAtIso: "2026-07-18T10:00:00Z",
  desiredDate: "Не указана",
  source: "Сайт",
  sourceLeadHref: "/sales/leads/9",
  clientHref: "/sales/clients",
  organizationHref: "/settings/organizations",
  description: "Описание",
  productCategory: "Форма",
  sport: "Футбол",
  quantity: "Не указано",
  itemCount: 1,
  items: [{
    id: 1,
    nomenclatureId: 1,
    nomenclatureVariantId: null,
    productModelId: 5,
    productModelArticle: "213",
    productModelName: "Футболка",
    productModelSizeType: "men",
    assemblyVariantId: 11,
    assemblyVariantName: "С отстрочкой",
    assemblyVariantTotalCost: "450",
    vatRateId: null,
    vatRatePercent: "",
    variantSnapshots: [],
    snapshotName: "Футболка",
    sizeRange: "S-L",
    personalization: "",
    color: "",
    unit: "шт",
    quantity: "10",
    unitPrice: "1 500,00 ₽",
    unitPriceValue: "1500",
    grossAmount: "15 000,00 ₽",
    discountPercent: "",
    discountAmount: "0,00 ₽",
    lineAmount: "15 000,00 ₽",
    lineAmountValue: "15000",
  }],
};

test("enriches zero amount from demo catalog and sums sewing from items", () => {
  const metrics = buildOrderCardMetrics({
    order: baseOrder,
    daysInWork: 5,
    lastActivityLabel: "21 июля",
    activityCount: 4,
    communicationCount: 2,
    openTasksCount: 1,
  });

  assert.equal(metrics.isDemoEnriched, true);
  assert.ok(metrics.amountValue > 0);
  assert.equal(metrics.sewingCostSource, "items");
  assert.equal(metrics.sewingCostValue, 4500);
  assert.equal(metrics.unitsPlanned, 10);
  assert.equal(metrics.productionPercent, 8);
  assert.equal(metrics.itemCount, 1);
});

test("maps production progress by order status", () => {
  const metrics = buildOrderCardMetrics({
    order: { ...baseOrder, statusCode: "production", amount: "100 000,00 ₽" },
    daysInWork: 12,
    lastActivityLabel: "24 июля",
    activityCount: 8,
    communicationCount: 3,
    openTasksCount: 0,
  });
  assert.equal(metrics.productionPercent, 58);
  assert.equal(metrics.paidPercent >= 0, true);
  assert.ok(metrics.marginPercent >= 0);
});
