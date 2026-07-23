import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCategoryTreeRows,
  filterCategoryTreeRows,
} from "./nomenclature-category-tree.ts";

function cat(partial) {
  return {
    description: null,
    is_active: true,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    nomenclature_type: "PRODUCT",
    ...partial,
  };
}

test("buildCategoryTreeRows numbers siblings 1 / 1.1 / 1.1.2 / 2", () => {
  const categories = [
    cat({ id: 2, parent_id: 1, name: "A1", code: "a1", sort_order: 0 }),
    cat({ id: 1, parent_id: null, name: "A", code: "a", sort_order: 0 }),
    cat({
      id: 4,
      parent_id: 2,
      name: "A1b",
      code: "a1b",
      sort_order: 1,
    }),
    cat({
      id: 3,
      parent_id: 2,
      name: "A1a",
      code: "a1a",
      sort_order: 0,
    }),
    cat({ id: 5, parent_id: null, name: "B", code: "b", sort_order: 1 }),
  ];

  const rows = buildCategoryTreeRows(categories);
  assert.deepEqual(
    rows.map((row) => [row.outline, row.category.code, row.depth]),
    [
      ["1", "a", 0],
      ["1.1", "a1", 1],
      ["1.1.1", "a1a", 2],
      ["1.1.2", "a1b", 2],
      ["2", "b", 0],
    ],
  );
  assert.equal(rows[0].hasChildren, true);
  assert.equal(rows[4].hasChildren, false);
});

test("filterCategoryTreeRows keeps ancestors of matches", () => {
  const categories = [
    cat({ id: 1, parent_id: null, name: "Продукция", code: "product" }),
    cat({
      id: 2,
      parent_id: 1,
      name: "Футболки",
      code: "tshirts",
      sort_order: 0,
    }),
    cat({
      id: 3,
      parent_id: null,
      name: "Услуги",
      code: "service",
      sort_order: 1,
    }),
  ];
  const rows = buildCategoryTreeRows(categories);
  const filtered = filterCategoryTreeRows(rows, "футб");
  assert.deepEqual(
    filtered.map((row) => row.category.code),
    ["product", "tshirts"],
  );
});
