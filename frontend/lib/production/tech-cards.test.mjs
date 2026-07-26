import assert from "node:assert/strict";
import test from "node:test";

import {
  filterTechCardsClient,
  formatVolumeUnit,
  stageResultStatusLabel,
  techCardStatusTone,
} from "./tech-cards.ts";

const sampleCards = [
  {
    id: 1,
    sales_order_id: 4,
    sales_order_item_id: 11,
    number: "SO-2026-000004-01",
    card_seq: 1,
    status: "draft",
    quantity: "12",
    nomenclature_id: 1,
    nomenclature_name: "Футболка игровая",
    product_model_article: "213",
    product_model_name: "Футболка",
    assembly_variant_name: null,
    current_stage_order: null,
    current_stage_label: "Раскрой",
    unit_lines: [],
    created_at: "2026-07-26T00:00:00Z",
    updated_at: "2026-07-26T12:00:00Z",
    order_number: "SO-2026-000004",
  },
  {
    id: 2,
    sales_order_id: 5,
    sales_order_item_id: 21,
    number: "SO-2026-000005-01",
    card_seq: 1,
    status: "in_progress",
    quantity: "6",
    nomenclature_id: 2,
    nomenclature_name: "Шорты",
    product_model_article: null,
    product_model_name: "Шорты",
    assembly_variant_name: null,
    current_stage_order: 2,
    current_stage_label: "Пошив",
    unit_lines: [],
    created_at: "2026-07-26T00:00:00Z",
    updated_at: "2026-07-26T13:00:00Z",
    order_number: "SO-2026-000005",
  },
];

test("techCardStatusTone maps card statuses", () => {
  assert.equal(techCardStatusTone("draft"), "warning");
  assert.equal(techCardStatusTone("in_progress"), "primary");
  assert.equal(techCardStatusTone("completed"), "success");
  assert.equal(techCardStatusTone("cancelled"), "neutral");
});

test("filterTechCardsClient filters by search, status, and stage", () => {
  assert.equal(
    filterTechCardsClient(sampleCards, { search: "футболка" }).length,
    1,
  );
  assert.equal(
    filterTechCardsClient(sampleCards, { status: "in_progress" }).length,
    1,
  );
  assert.equal(
    filterTechCardsClient(sampleCards, { stage: "пошив" }).length,
    1,
  );
  assert.equal(
    filterTechCardsClient(sampleCards, {
      search: "000004",
      status: "draft",
      stage: "раскрой",
    }).length,
    1,
  );
  assert.equal(
    filterTechCardsClient(sampleCards, { status: "completed" }).length,
    0,
  );
});

test("formatVolumeUnit localizes known units", () => {
  assert.equal(formatVolumeUnit("linear_meters"), "м.п.");
  assert.equal(formatVolumeUnit("pieces"), "шт.");
  assert.equal(formatVolumeUnit("hours"), "hours");
});

test("stageResultStatusLabel localizes stage statuses", () => {
  assert.equal(stageResultStatusLabel("pending"), "Ожидает");
  assert.equal(stageResultStatusLabel("in_progress"), "В работе");
  assert.equal(stageResultStatusLabel("completed"), "Завершён");
  assert.equal(stageResultStatusLabel("skipped"), "Пропущен");
});
