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
  amountValue: "",
  currencyCode: "RUB",
  designApprovalStatus: "not_required",
  itemsSubtotal: "Не указана",
  itemsSubtotalValue: "0",
  discountPercent: "",
  discountAmount: "0,00 ₽",
  discountAmountValue: "0",
  vatAmount: "0,00 ₽",
  vatAmountValue: "0",
  amountNet: "0,00 ₽",
  amountNetValue: "0",
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
    routingTemplateId: 3,
    routingTemplateName: "Маршрут A",
    vatRateId: null,
    vatRatePercent: "",
    priceIncludesVat: true,
    vatAmount: "0,00 ₽",
    vatAmountValue: "0",
    lineTotal: "15 000,00 ₽",
    lineTotalValue: "15000",
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

  assert.equal(metrics.isDemoEnriched, false);
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

test("uses API order discount fields without demo amount fallback", () => {
  const metrics = buildOrderCardMetrics({
    order: {
      ...baseOrder,
      amount: "800,00 ₽",
      amountValue: "800",
      itemsSubtotal: "1 000,00 ₽",
      itemsSubtotalValue: "1000",
      discountPercent: "20",
      discountAmount: "200,00 ₽",
      discountAmountValue: "200",
    },
    daysInWork: 3,
    lastActivityLabel: "сегодня",
    activityCount: 1,
    communicationCount: 0,
    openTasksCount: 0,
  });
  assert.equal(metrics.amountValue, 800);
  assert.equal(metrics.itemsSubtotalValue, 1000);
  assert.equal(metrics.discountPercent, "20");
  assert.equal(metrics.discountAmountValue, 200);
  assert.equal(metrics.amountLabel, "800,00 ₽");
  assert.equal(metrics.currencyCode, "RUB");
});
