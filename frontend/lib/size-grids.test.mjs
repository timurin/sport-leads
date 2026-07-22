import assert from "node:assert/strict";
import test from "node:test";

import {
  SIZE_GRID_SIZE_TYPE_LABELS,
  filterSizeGrids,
  formatHeightLabel,
  parseSizeGridRouteId,
} from "../lib/size-grids.ts";

test("parseSizeGridRouteId accepts positive ids", () => {
  assert.equal(parseSizeGridRouteId("12"), 12);
  assert.equal(parseSizeGridRouteId("0"), null);
  assert.equal(parseSizeGridRouteId("ab"), null);
});

test("formatHeightLabel shows dash for empty", () => {
  assert.equal(formatHeightLabel("158-164"), "158-164");
  assert.equal(formatHeightLabel(null), "—");
  assert.equal(formatHeightLabel("  "), "—");
});

test("filterSizeGrids filters by type and query", () => {
  const grids = [
    {
      id: 1,
      name: "Мужская (Mosmade)",
      size_type: "men",
      source_note: null,
      row_count: 18,
      created_at: "",
      updated_at: "",
    },
    {
      id: 2,
      name: "Женская (Mosmade)",
      size_type: "women",
      source_note: null,
      row_count: 14,
      created_at: "",
      updated_at: "",
    },
  ];
  assert.equal(filterSizeGrids(grids, "", "men").length, 1);
  assert.equal(filterSizeGrids(grids, "жен", "all").length, 1);
  assert.equal(SIZE_GRID_SIZE_TYPE_LABELS.men, "Мужской");
});
