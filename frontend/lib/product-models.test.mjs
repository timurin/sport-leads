import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProductModelCatalogTreeRows,
  compareProductModelsByListSort,
  filterProductModels,
  formatAssemblyCost,
  formatAssemblyCostBounds,
  formatAssemblyVariantCostRange,
  isProductModelRequisitesDirty,
  parseAssemblyCostInput,
  parseProductModelRouteId,
  productModelFolderSelectOptions,
  productModelLabel,
  productModelStatusTone,
  sumSelectedSewingOperationCosts,
  toProductModelRequisitesDraft,
  toProductModelVersionViews,
  validateAssemblyOperationLineDraft,
  validateAssemblyVariantDraft,
  validateProductModelCreateDraft,
  visibleProductModelCatalogTreeRows,
} from "./product-models.ts";

const sample = [
  {
    id: 1,
    article: "213",
    name: "Футболка спортивная",
    size_type: "men",
    size_grid_id: null,
    product_type_id: null,
    product_type_name: null,
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
    product_type_id: 1,
    product_type_name: "Футболка",
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
    product_type_id: null,
    product_type_name: null,
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
  assert.equal(
    filterProductModels(sample, { productTypeId: 1 }).length,
    1,
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
        product_type_id: null,
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
        product_type_id: null,
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
  assert.equal(
    isProductModelRequisitesDirty(model, {
      ...toProductModelRequisitesDraft(model),
      folder_id: 9,
    }),
    true,
  );
});

test("productModelFolderSelectOptions flattens nested folders for the card Select", () => {
  const options = productModelFolderSelectOptions([
    {
      id: 1,
      name: "Одежда",
      parent_id: null,
      sort_order: 0,
      created_at: "2026-08-26T00:00:00Z",
      updated_at: "2026-08-26T00:00:00Z",
    },
    {
      id: 2,
      name: "Футболки",
      parent_id: 1,
      sort_order: 0,
      created_at: "2026-08-26T00:00:00Z",
      updated_at: "2026-08-26T00:00:00Z",
    },
  ]);
  assert.deepEqual(
    options.map((row) => ({ id: row.id, depth: row.depth, name: row.name })),
    [
      { id: 1, depth: 0, name: "Одежда" },
      { id: 2, depth: 1, name: "Футболки" },
    ],
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

test("formatAssemblyCostBounds uses list API min/max fields", () => {
  assert.equal(formatAssemblyCostBounds(null, null), "—");
  assert.equal(formatAssemblyCostBounds("100.00", "100.00"), "100,00 ₽");
  assert.equal(
    formatAssemblyCostBounds("50.50", "150.00"),
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
  assert.equal(
    sumSelectedSewingOperationCosts([
      { cost: "100.00", quantity_per_item: 2 },
      { cost: "50,50", quantity_per_item: 1 },
    ]),
    250.5,
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

test("buildProductModelCatalogTreeRows folders then models by sort_order", () => {
  const folders = [
    {
      id: 1,
      name: "Root",
      parent_id: null,
      sort_order: 0,
      created_at: "",
      updated_at: "",
    },
    {
      id: 2,
      name: "Child",
      parent_id: 1,
      sort_order: 0,
      created_at: "",
      updated_at: "",
    },
  ];
  const models = [
    {
      id: 10,
      article: "R-1",
      name: "Model root",
      size_type: "men",
      size_grid_id: null,
      product_type_id: null,
      product_type_name: null,
      default_routing_template_id: null,
      description: null,
      patterns_path: null,
      constructor_name: null,
      patterns_created_on: null,
      cover_image_url: null,
      folder_id: null,
      sort_order: 0,
      status: "draft",
      created_at: "",
      updated_at: "",
    },
    {
      id: 11,
      article: "C-1",
      name: "Model child",
      size_type: "men",
      size_grid_id: null,
      product_type_id: null,
      product_type_name: null,
      default_routing_template_id: null,
      description: null,
      patterns_path: null,
      constructor_name: null,
      patterns_created_on: null,
      cover_image_url: null,
      folder_id: 2,
      sort_order: 0,
      status: "draft",
      created_at: "",
      updated_at: "",
    },
  ];
  const rows = buildProductModelCatalogTreeRows(folders, models);
  assert.deepEqual(
    rows.map((row) => `${row.kind}:${row.id}:${row.depth}`),
    ["folder:1:0", "folder:2:1", "model:11:2", "model:10:0"],
  );
  const collapsed = visibleProductModelCatalogTreeRows(rows, new Set());
  assert.deepEqual(
    collapsed.map((row) => `${row.kind}:${row.id}`),
    ["folder:1", "model:10"],
  );
});
test("compareProductModelsByListSort orders by article and cost", () => {
  const labels = {
    productType: () => "",
    sizeGrid: () => "",
    cost: (model) =>
      model.assembly_cost_min == null
        ? null
        : Number(model.assembly_cost_min),
  };
  const a = {
    ...sample[0],
    id: 1,
    article: "B-10",
    name: "B",
    folder_id: null,
    sort_order: 0,
    assembly_cost_min: "200",
    assembly_cost_max: "200",
  };
  const b = {
    ...sample[0],
    id: 2,
    article: "A-10",
    name: "A",
    folder_id: null,
    sort_order: 1,
    assembly_cost_min: "50",
    assembly_cost_max: "50",
  };
  assert.ok(
    compareProductModelsByListSort(a, b, "article", "asc", labels) > 0,
  );
  assert.ok(
    compareProductModelsByListSort(a, b, "article", "desc", labels) < 0,
  );
  assert.ok(compareProductModelsByListSort(a, b, "cost", "asc", labels) > 0);

  const sorted = buildProductModelCatalogTreeRows([], [a, b], {
    compareModels: (left, right) =>
      compareProductModelsByListSort(left, right, "article", "asc", labels),
  });
  assert.deepEqual(
    sorted.filter((row) => row.kind === "model").map((row) => row.id),
    [2, 1],
  );
});
