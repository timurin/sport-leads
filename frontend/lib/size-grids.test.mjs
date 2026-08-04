import assert from "node:assert/strict";
import test from "node:test";

import {
  SIZE_GRID_SIZE_TYPE_LABELS,
  emptySizeGridRowDraft,
  filterSizeGrids,
  formatHeightLabel,
  parseSizeGridRouteId,
  sizeGridRowDraftToPayload,
  validateSizeGridDraft,
  validateSizeGridRowDraft,
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

test("validateSizeGridDraft and row draft", () => {
  assert.equal(
    validateSizeGridDraft({ name: "", size_type: "men", source_note: "" }),
    "Укажите наименование сетки",
  );
  assert.equal(
    validateSizeGridDraft({
      name: "Kids",
      size_type: "kids",
      source_note: "",
    }),
    null,
  );
  assert.equal(
    validateSizeGridRowDraft(emptySizeGridRowDraft()),
    "Укажите RU размер",
  );
  const ok = {
    ...emptySizeGridRowDraft(1),
    ru_size: "46",
    int_label: "S",
    chest: "92-96",
    waist: "80-84",
    hip: "96-99",
    height_s: "158-164",
  };
  assert.equal(validateSizeGridRowDraft(ok), null);
  assert.deepEqual(sizeGridRowDraftToPayload(ok), {
    sort_order: 1,
    ru_size: "46",
    int_label: "S",
    chest: "92-96",
    waist: "80-84",
    hip: "96-99",
    height_s: "158-164",
    height_n: null,
    height_t: null,
  });
});
