import assert from "node:assert/strict";
import test from "node:test";

import { fromApiNomenclature, nomenclatureLabel } from "../nomenclature.ts";

test("maps Decimal base price and preserves nomenclature fields", () => {
  const item = fromApiNomenclature({
    id: 7,
    article: "FORM-001",
    name: "Футбольная форма",
    short_name: "Форма",
    description: null,
    category: "Форма",
    category_id: null,
    nomenclature_type: "PRODUCT",
    unit: "шт",
    base_price: "12500",
    currency: "RUB",
    is_active: true,
    created_at: "2026-07-18T10:00:00Z",
    updated_at: "2026-07-18T10:00:00Z",
  });

  assert.equal(item.article, "FORM-001");
  assert.equal(item.basePrice, "12500.00");
  assert.equal(item.is_active, true);
  assert.equal(nomenclatureLabel(item), "FORM-001 — Футбольная форма");
});
