import assert from "node:assert/strict";
import test from "node:test";

import {
  filterWarehouses,
  validateWarehouseDraft,
} from "./warehouses.ts";

const sample = [
  {
    id: 1,
    name: "Основной",
    code: "main",
    is_active: true,
    is_default: true,
    created_at: "2026-07-30T00:00:00Z",
    updated_at: "2026-07-30T00:00:00Z",
  },
  {
    id: 2,
    name: "Резервный",
    code: "reserve",
    is_active: true,
    is_default: false,
    created_at: "2026-07-30T00:00:00Z",
    updated_at: "2026-07-30T00:00:00Z",
  },
];

test("filterWarehouses matches name and code", () => {
  assert.equal(filterWarehouses(sample, "основ").length, 1);
  assert.equal(filterWarehouses(sample, "reserve").length, 1);
  assert.equal(filterWarehouses(sample, "").length, 2);
});

test("validateWarehouseDraft rejects empty and inactive default", () => {
  assert.equal(
    validateWarehouseDraft({
      name: "",
      code: "x",
      is_active: true,
      is_default: false,
    }),
    "Укажите наименование",
  );
  assert.equal(
    validateWarehouseDraft({
      name: "A",
      code: "a",
      is_active: false,
      is_default: true,
    }),
    "Склад по умолчанию должен быть активным",
  );
  assert.equal(
    validateWarehouseDraft({
      name: "A",
      code: "a",
      is_active: true,
      is_default: false,
    }),
    null,
  );
});
