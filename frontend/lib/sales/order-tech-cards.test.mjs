import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOrderTechCardRows,
  buildOrderTechCardsSummary,
} from "./order-tech-cards.ts";

const preview = {
  sales_order_id: 4,
  order_number: "SO-2026-000004",
  create_count: 1,
  revive_count: 0,
  lines: [
    {
      sales_order_item_id: 11,
      position: 1,
      snapshot_name: "Футболка игровая",
      quantity: "12",
      eligible: true,
      skip_reason: null,
      existing_card_id: null,
      existing_status: null,
      would_create: true,
      would_revive: false,
      planned_unit_line_count: 12,
    },
    {
      sales_order_item_id: 12,
      position: 2,
      snapshot_name: "Доставка",
      quantity: "1",
      eligible: false,
      skip_reason: "nomenclature_type_not_allowed:service",
      existing_card_id: null,
      existing_status: null,
      would_create: false,
      would_revive: false,
      planned_unit_line_count: null,
    },
  ],
};

test("builds one row per eligible product line only", () => {
  const rows = buildOrderTechCardRows(preview, []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "missing");
  assert.equal(rows[0].unitLineCount, 12);
  assert.equal(rows[0].href, null);
  assert.equal(rows[0].title, "Позиция 1 — Футболка игровая");
  assert.deepEqual(rows[0].stageStrips, []);

  const summary = buildOrderTechCardsSummary(4, rows, []);
  assert.equal(summary.eligibleCount, 1);
  assert.equal(summary.missingCount, 1);
  assert.equal(summary.openListHref, "/production/tech-cards?orderId=4");
  assert.equal(summary.completenessPercent, 0);
  assert.equal(summary.readinessPercent, 0);
});

test("maps active card status and document href", () => {
  const cards = [
    {
      id: 77,
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
      assembly_variant_name: "С отстрочкой",
      current_stage_order: null,
      current_stage_label: null,
      unit_lines: [{ id: 1, unit_index: 1 }, { id: 2, unit_index: 2 }],
      created_at: "2026-07-26T00:00:00Z",
      updated_at: "2026-07-26T00:00:00Z",
    },
  ];
  const rows = buildOrderTechCardRows(preview, cards);
  assert.equal(rows[0].status, "draft");
  assert.equal(rows[0].number, "SO-2026-000004-01");
  assert.equal(rows[0].href, "/production/tech-cards/77");
  assert.equal(rows[0].unitLineCount, 2);

  const summary = buildOrderTechCardsSummary(4, rows, cards);
  assert.equal(summary.draftCount, 1);
  assert.equal(summary.missingCount, 0);
  assert.equal(summary.manufacturingComplete, false);
  assert.equal(summary.readinessPercent, 0);
  assert.equal(summary.createdVsPlannedLabel, null);
});

test("row number and soft progress use live planned count", () => {
  const cards = [
    {
      id: 77,
      sales_order_id: 4,
      sales_order_item_id: 11,
      number: "1310-1",
      display_number: "1310-1/5",
      tech_cards_planned_count: 5,
      card_seq: 1,
      status: "draft",
      quantity: "12",
      nomenclature_id: 1,
      nomenclature_name: "Футболка игровая",
      product_model_article: null,
      product_model_name: null,
      assembly_variant_name: null,
      current_stage_order: 1,
      current_stage_label: "Раскрой",
      unit_lines: [{}, {}],
      created_at: "2026-07-26T00:00:00Z",
      updated_at: "2026-07-26T00:00:00Z",
    },
  ];
  const rows = buildOrderTechCardRows(preview, cards);
  assert.equal(rows[0].number, "1310-1/5");
  const summary = buildOrderTechCardsSummary(4, rows, cards, 5);
  assert.equal(summary.createdVsPlannedLabel, "1 из 5");
  assert.equal(summary.plannedCount, 5);
});

test("completed cards mark manufacturing complete", () => {
  const cards = [
    {
      id: 77,
      sales_order_id: 4,
      sales_order_item_id: 11,
      number: "SO-2026-000004-01",
      card_seq: 1,
      status: "completed",
      quantity: "12",
      nomenclature_id: 1,
      nomenclature_name: "Футболка игровая",
      product_model_article: null,
      product_model_name: null,
      assembly_variant_name: null,
      current_stage_order: 3,
      current_stage_label: "Закрыта",
      unit_lines: [],
      created_at: "2026-07-26T00:00:00Z",
      updated_at: "2026-07-26T00:00:00Z",
    },
  ];
  const rows = buildOrderTechCardRows(preview, cards);
  const summary = buildOrderTechCardsSummary(4, rows, cards);
  assert.equal(rows[0].status, "completed");
  assert.equal(summary.manufacturingComplete, true);
  assert.equal(summary.completenessPercent, 100);
  assert.equal(summary.readinessPercent, 100);
});

function stage(order, label, status) {
  return {
    id: order,
    technical_card_id: 77,
    stage_order: order,
    stage_label: label,
    status,
    performer_name: null,
    started_at: null,
    completed_at: null,
    scrap_qty: null,
    rework_qty: null,
    notes: null,
    created_at: "2026-07-26T00:00:00Z",
    updated_at: "2026-07-26T00:00:00Z",
  };
}

test("26.2.1 readiness is 0 until launched and 100 at ready_to_ship, not completedCount/eligibleCount", () => {
  const inProgress = {
    id: 77,
    sales_order_id: 4,
    sales_order_item_id: 11,
    number: "SO-2026-000004-01",
    card_seq: 1,
    status: "in_progress",
    quantity: "12",
    nomenclature_id: 1,
    nomenclature_name: "Футболка игровая",
    product_model_article: null,
    product_model_name: null,
    assembly_variant_name: null,
    current_stage_order: 2,
    current_stage_label: "Пошив",
    unit_lines: [],
    stage_results: [
      stage(1, "Дизайн", "completed"),
      stage(2, "Пошив", "in_progress"),
      stage(3, "Готовы к отгрузке", "pending"),
      stage(4, "Отгружены", "pending"),
    ],
    created_at: "2026-07-26T00:00:00Z",
    updated_at: "2026-07-26T00:00:00Z",
  };
  const rows = buildOrderTechCardRows(preview, [inProgress]);
  const summary = buildOrderTechCardsSummary(4, rows, [inProgress]);
  assert.equal(rows[0].status, "in_progress");
  assert.equal(rows[0].title, "SO-2026-000004-01 — Футболка игровая");
  assert.deepEqual(
    rows[0].stageStrips.map((strip) => strip.kind),
    ["done", "active", "upcoming", "upcoming"],
  );
  assert.equal(summary.completedCount, 0);
  assert.equal(summary.readinessPercent, 33);

  const ready = {
    ...inProgress,
    current_stage_order: 3,
    current_stage_label: "Готовы к отгрузке",
    stage_results: [
      stage(1, "Дизайн", "completed"),
      stage(2, "Пошив", "completed"),
      stage(3, "Готовы к отгрузке", "completed"),
      stage(4, "Отгружены", "pending"),
    ],
  };
  const readyRows = buildOrderTechCardRows(preview, [ready]);
  const readySummary = buildOrderTechCardsSummary(4, readyRows, [ready]);
  assert.equal(readySummary.completedCount, 0);
  assert.equal(readySummary.readinessPercent, 100);
  assert.equal(readySummary.manufacturingComplete, true);
});
