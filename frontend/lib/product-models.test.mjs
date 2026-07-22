import assert from "node:assert/strict";
import test from "node:test";

import {
  filterProductModels,
  formatAssemblyCost,
  formatAssemblyVariantCostRange,
  isProductModelRequisitesDirty,
  parseAssemblyCostInput,
  parseProductModelRouteId,
  productModelLabel,
  productModelStatusTone,
  sumSelectedSewingOperationCosts,
  toProductModelRequisitesDraft,
  toProductModelVersionViews,
  validateAssemblyOperationLineDraft,
  validateAssemblyVariantDraft,
  validateProductModelCreateDraft,
} from "./product-models.ts";

const sample = [
  {
    id: 1,
    article: "213",
    name: "Футболка спортивная",
    size_type: "men",
    size_grid_id: null,
    description: "Мужская",
    patterns_path: null,
    constructor_name: null,
    patterns_created_on: null,
    status: "draft",
    cover_image_url: null,
    created_at: "2026-07-22T10:00:00Z",
    updated_at: "2026-07-22T10:00:00Z",
  },
  {
    id: 2,
    article: "213-W",
    name: "Футболка женская",
    size_type: "women",
    size_grid_id: 2,
    description: null,
    patterns_path: null,
    constructor_name: null,
    patterns_created_on: null,
    status: "active",
    cover_image_url: null,
    created_at: "2026-07-22T10:00:00Z",
    updated_at: "2026-07-22T10:00:00Z",
  },
  {
    id: 3,
    article: "K-01",
    name: "Детская форма",
    size_type: "kids",
    size_grid_id: null,
    description: null,
    patterns_path: null,
    constructor_name: null,
    patterns_created_on: null,
    status: "archived",
    cover_image_url: "/product-models/sample-cover.svg",
    created_at: "2026-07-22T10:00:00Z",
    updated_at: "2026-07-22T10:00:00Z",
  },
];

test("productModelLabel joins article and name", () => {
  assert.equal(productModelLabel(sample[0]), "213 — Футболка спортивная");
});

test("productModelStatusTone maps catalog statuses", () => {
  assert.equal(productModelStatusTone("draft"), "warning");
  assert.equal(productModelStatusTone("active"), "success");
  assert.equal(productModelStatusTone("archived"), "neutral");
});

test("filterProductModels filters by search, status and size_type", () => {
  assert.equal(filterProductModels(sample, { search: "213" }).length, 2);
  assert.equal(filterProductModels(sample, { status: "active" }).length, 1);
  assert.equal(filterProductModels(sample, { sizeType: "kids" }).length, 1);
  assert.equal(
    filterProductModels(sample, {
      search: "футболка",
      status: "draft",
      sizeType: "men",
    }).length,
    1,
  );
  assert.equal(
    filterProductModels(sample, { search: "нет такого" }).length,
    0,
  );
});

test("parseProductModelRouteId accepts positive integers only", () => {
  assert.equal(parseProductModelRouteId("12"), 12);
  assert.equal(parseProductModelRouteId("demo-reference"), null);
  assert.equal(parseProductModelRouteId("0"), null);
  assert.equal(parseProductModelRouteId("-1"), null);
  assert.equal(parseProductModelRouteId("12a"), null);
});

test("toProductModelVersionViews marks draft active and published baseline", () => {
  const views = toProductModelVersionViews([
    {
      id: 10,
      product_model_id: 1,
      version_number: 1,
      label: "v1",
      state: "archived",
      note: null,
      published_at: null,
      created_at: "2026-07-01T10:00:00Z",
      updated_at: "2026-07-01T10:00:00Z",
    },
    {
      id: 11,
      product_model_id: 1,
      version_number: 2,
      label: null,
      state: "published",
      note: null,
      published_at: "2026-07-10T10:00:00Z",
      created_at: "2026-07-10T10:00:00Z",
      updated_at: "2026-07-10T10:00:00Z",
    },
    {
      id: 12,
      product_model_id: 1,
      version_number: 3,
      label: "  ",
      state: "draft",
      note: "правка",
      published_at: null,
      created_at: "2026-07-22T10:00:00Z",
      updated_at: "2026-07-22T10:00:00Z",
    },
  ]);

  assert.equal(views.length, 3);
  assert.equal(views[1].label, "v2");
  assert.equal(views[1].isPublishedBaseline, true);
  assert.equal(views[2].label, "v3");
  assert.equal(views[2].isActive, true);
  assert.equal(views.filter((item) => item.isActive).length, 1);
});

test("validateProductModelCreateDraft requires article, name and size grid", () => {
  assert.equal(
    validateProductModelCreateDraft({
      article: "",
      name: "Модель",
      size_type: "men",
      description: "",
      size_grid_id: 1,
    }),
    "Укажите артикул",
  );
  assert.equal(
    validateProductModelCreateDraft({
      article: "A-1",
      name: "  ",
      size_type: "women",
      description: "",
      size_grid_id: 1,
    }),
    "Укажите название",
  );
  assert.equal(
    validateProductModelCreateDraft({
      article: "A-1",
      name: "Модель",
      size_type: "kids",
      description: "ok",
      size_grid_id: null,
    }),
    "Выберите размерную сетку",
  );
  assert.equal(
    validateProductModelCreateDraft({
      article: "A-1",
      name: "Модель",
      size_type: "kids",
      description: "ok",
      size_grid_id: 3,
    }),
    null,
  );
});

test("isProductModelRequisitesDirty compares draft to model", () => {
  const model = sample[0];
  assert.equal(
    isProductModelRequisitesDirty(model, toProductModelRequisitesDraft(model)),
    false,
  );
  assert.equal(
    isProductModelRequisitesDirty(model, {
      ...toProductModelRequisitesDraft(model),
      name: "Другое имя",
    }),
    true,
  );
  assert.equal(
    isProductModelRequisitesDirty(
      {
        ...model,
        description: null,
        size_grid_id: null,
        patterns_path: null,
        constructor_name: null,
        patterns_created_on: null,
      },
      {
        article: model.article,
        name: model.name,
        size_type: model.size_type,
        description: "",
        size_grid_id: null,
        patterns_path: "",
        constructor_name: "",
        patterns_created_on: "",
      },
    ),
    false,
  );
  assert.equal(
    isProductModelRequisitesDirty(model, {
      ...toProductModelRequisitesDraft(model),
      patterns_path: "\\\\files\\patterns\\213",
    }),
    true,
  );
  assert.equal(
    isProductModelRequisitesDirty(model, {
      ...toProductModelRequisitesDraft(model),
      size_grid_id: 10,
    }),
    true,
  );
});

test("formatAssemblyCost and parseAssemblyCostInput handle decimals", () => {
  assert.equal(formatAssemblyCost("150.50"), "150,50");
  assert.equal(formatAssemblyCost(0), "0,00");
  assert.equal(parseAssemblyCostInput("50,5"), "50.50");
  assert.equal(parseAssemblyCostInput("10"), "10.00");
  assert.equal(parseAssemblyCostInput("-1"), null);
  assert.equal(parseAssemblyCostInput("abc"), null);
});

test("formatAssemblyVariantCostRange shows min–max across variants", () => {
  assert.equal(formatAssemblyVariantCostRange([]), "—");
  assert.equal(
    formatAssemblyVariantCostRange([{ total_cost: "100.00" }]),
    "100,00 ₽",
  );
  assert.equal(
    formatAssemblyVariantCostRange([
      { total_cost: "50.5" },
      { total_cost: "150.00" },
      { total_cost: "90" },
    ]),
    "от 50,50 — до 150,00 ₽",
  );
});

test("sumSelectedSewingOperationCosts totals selected catalog rows", () => {
  assert.equal(
    sumSelectedSewingOperationCosts([
      { cost: "100.00" },
      { cost: "50,50" },
    ]),
    150.5,
  );
  assert.equal(sumSelectedSewingOperationCosts([]), 0);
});

test("validateAssemblyVariantDraft and operation line draft", () => {
  assert.equal(validateAssemblyVariantDraft({ name: "  " }), "Укажите название варианта");
  assert.equal(validateAssemblyVariantDraft({ name: "С отстрочкой" }), null);
  assert.equal(
    validateAssemblyOperationLineDraft({ operation_name: "", cost: "10" }),
    "Укажите название операции",
  );
  assert.equal(
    validateAssemblyOperationLineDraft({ operation_name: "Отстрочка", cost: "-1" }),
    "Укажите стоимость операции (число ≥ 0)",
  );
  assert.equal(
    validateAssemblyOperationLineDraft({ operation_name: "Отстрочка", cost: "50,00" }),
    null,
  );
});
