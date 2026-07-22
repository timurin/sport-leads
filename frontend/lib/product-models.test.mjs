import assert from "node:assert/strict";
import test from "node:test";

import {
  filterProductModels,
  parseProductModelRouteId,
  productModelLabel,
  productModelStatusTone,
  toProductModelVersionViews,
} from "./product-models.ts";

const sample = [
  {
    id: 1,
    article: "213",
    name: "Футболка спортивная",
    size_type: "men",
    description: "Мужская",
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
    description: null,
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
    description: null,
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
