import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveNomenclatureCategoryId,
  toNomenclatureRequisitesDraft,
} from "./nomenclature.ts";

const categories = [
  {
    id: 2,
    parent_id: null,
    name: "Материалы",
    code: "materials",
    description: null,
    nomenclature_type: "MATERIAL",
    is_active: true,
    sort_order: 0,
    created_at: "",
    updated_at: "",
  },
  {
    id: 1,
    parent_id: null,
    name: "Продукция",
    code: "products",
    description: null,
    nomenclature_type: "PRODUCT",
    is_active: true,
    sort_order: 1,
    created_at: "",
    updated_at: "",
  },
];

test("resolveNomenclatureCategoryId matches legacy name across types (4.9.1)", () => {
  assert.equal(
    resolveNomenclatureCategoryId(null, "Продукция", categories, "PRODUCT"),
    1,
  );
  assert.equal(
    resolveNomenclatureCategoryId(null, "Продукция", categories, "MATERIAL"),
    1,
  );
});

test("toNomenclatureRequisitesDraft hydrates category_id from legacy label", () => {
  const draft = toNomenclatureRequisitesDraft(
    {
      id: 3,
      name: "Ткань",
      short_name: null,
      description: null,
      category: "Материалы",
      category_id: null,
      storage_unit_id: null,
      nomenclature_type: "MATERIAL",
      product_type_id: null,
      unit: "м",
      base_price: "1",
      currency: "RUB",
      is_active: true,
      created_at: "",
      updated_at: "",
      basePrice: "1",
    },
    categories,
  );
  assert.equal(draft.category_id, 2);
});
