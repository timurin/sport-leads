import assert from "node:assert/strict";
import test from "node:test";

import { buildOrderTechCardsDemo } from "./order-tech-cards-demo.ts";

const item = {
  id: 11,
  nomenclatureId: 1,
  nomenclatureVariantId: null,
  productModelId: 5,
  productModelArticle: "213",
  productModelName: "Футболка",
  productModelSizeType: "men",
  assemblyVariantId: 2,
  assemblyVariantName: "С отстрочкой",
  assemblyVariantTotalCost: "450",
  vatRateId: null,
  vatRatePercent: "",
  variantSnapshots: [],
  snapshotName: "Футболка игровая",
  sizeRange: "S-L",
  personalization: "",
  color: "",
  unit: "шт",
  quantity: "12",
  unitPrice: "1000",
  unitPriceValue: "1000",
  grossAmount: "12000",
  discountPercent: "",
  discountAmount: "0",
  lineAmount: "12000",
  lineAmountValue: "12000",
};

test("builds one demo tech card row per order item", () => {
  const { rows, summary } = buildOrderTechCardsDemo({
    orderId: "4",
    orderNumber: "SO-2026-000004",
    orderStatus: "production",
    items: [item, { ...item, id: 12, snapshotName: "Шорты" }],
  });

  assert.equal(rows.length, 2);
  assert.equal(summary.total, 2);
  assert.equal(rows[0].unitLineCount, 12);
  assert.ok(rows[0].number.includes("SO-2026-000004"));
  assert.equal(typeof summary.statusLabel, "string");
});

test("completed order marks cards completed", () => {
  const { rows, summary } = buildOrderTechCardsDemo({
    orderId: "4",
    orderNumber: "SO-2026-000004",
    orderStatus: "completed",
    items: [item],
  });
  assert.equal(rows[0].status, "completed");
  assert.equal(summary.manufacturingComplete, true);
});
