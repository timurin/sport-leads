import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCompositionReplaceLines,
  buildTechCardHistoryEntries,
  filterTechCardsClient,
  findSewingHostRoutingLineIndex,
  formatVolumeUnit,
  groupOperationLinesBySource,
  isSewingStageRoutingLine,
  materialDraftsFromComposition,
  stageResultStatusLabel,
  TECH_CARD_MEDIA_MAX,
  techCardAllowsStageExecution,
  techCardDocumentNumberLabel,
  techCardShopStageStatus,
  techCardShowsCurrentStageBadge,
  techCardStatusTone,
  unitLineSizeTypeLabel,
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

test("techCardShowsCurrentStageBadge when card is not cancelled", () => {
  assert.equal(techCardShowsCurrentStageBadge("draft"), true);
  assert.equal(techCardShowsCurrentStageBadge("cancelled"), false);
  assert.equal(techCardShowsCurrentStageBadge("in_progress"), true);
  assert.equal(techCardShowsCurrentStageBadge("completed"), true);
});

test("techCardAllowsStageExecution for draft and in_progress", () => {
  assert.equal(techCardAllowsStageExecution("draft"), true);
  assert.equal(techCardAllowsStageExecution("completed"), false);
  assert.equal(techCardAllowsStageExecution("cancelled"), false);
  assert.equal(techCardAllowsStageExecution("in_progress"), true);
});

test("techCardShopStageStatus reads current stage result", () => {
  assert.equal(
    techCardShopStageStatus({
      status: "draft",
      current_stage_order: 3,
      current_stage_label: "Печать",
      stage_results: [
        {
          id: 1,
          technical_card_id: 1,
          stage_order: 2,
          stage_label: "Раскрой",
          status: "completed",
          performer_name: null,
          started_at: null,
          completed_at: null,
          scrap_qty: null,
          rework_qty: null,
          notes: null,
          created_at: "2026-07-28T00:00:00Z",
          updated_at: "2026-07-28T00:00:00Z",
        },
        {
          id: 2,
          technical_card_id: 1,
          stage_order: 3,
          stage_label: "Печать",
          status: "in_progress",
          performer_name: null,
          started_at: null,
          completed_at: null,
          scrap_qty: null,
          rework_qty: null,
          notes: null,
          created_at: "2026-07-28T00:00:00Z",
          updated_at: "2026-07-28T00:00:00Z",
        },
      ],
    }),
    "in_progress",
  );
  assert.equal(
    techCardShopStageStatus({
      status: "draft",
      current_stage_order: 1,
      current_stage_label: "Дизайн",
      stage_results: [],
    }),
    "pending",
  );
});

test("filterTechCardsClient can filter by stage-result status", () => {
  const cards = [
    {
      ...sampleCards[0],
      status: "draft",
      current_stage_order: 1,
      current_stage_label: "Дизайн",
      stage_results: [
        {
          id: 10,
          technical_card_id: 1,
          stage_order: 1,
          stage_label: "Дизайн",
          status: "pending",
          performer_name: null,
          started_at: null,
          completed_at: null,
          scrap_qty: null,
          rework_qty: null,
          notes: null,
          created_at: "2026-07-28T00:00:00Z",
          updated_at: "2026-07-28T00:00:00Z",
        },
      ],
    },
  ];
  assert.equal(
    filterTechCardsClient(cards, { status: "draft", statusField: "card" }).length,
    1,
  );
  assert.equal(
    filterTechCardsClient(cards, { status: "pending", statusField: "stage" }).length,
    1,
  );
  assert.equal(
    filterTechCardsClient(cards, {
      status: "in_progress",
      statusField: "stage",
    }).length,
    0,
  );
});

test("isSewingStageRoutingLine matches Пошив by id or label", () => {
  assert.equal(
    isSewingStageRoutingLine(
      { production_stage_id: 4, stage_label: "Печать" },
      4,
    ),
    true,
  );
  assert.equal(
    isSewingStageRoutingLine(
      { production_stage_id: 9, stage_label: "Пошив" },
      4,
    ),
    true,
  );
  assert.equal(
    isSewingStageRoutingLine(
      { production_stage_id: 9, stage_label: "Печать" },
      4,
    ),
    false,
  );
  assert.equal(
    findSewingHostRoutingLineIndex(
      [
        { production_stage_id: 1, stage_label: "Дизайн" },
        { production_stage_id: 4, stage_label: "Пошив" },
      ],
      4,
    ),
    1,
  );
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

test("TECH_CARD_MEDIA_MAX is 3", () => {
  assert.equal(TECH_CARD_MEDIA_MAX, 3);
});

test("techCardDocumentNumberLabel joins order and card", () => {
  assert.equal(
    techCardDocumentNumberLabel("SO-2026-000004", "SO-2026-000004-01"),
    "SO-2026-000004 / SO-2026-000004-01",
  );
  assert.equal(techCardDocumentNumberLabel(null, "TK-01"), "TK-01");
  assert.equal(techCardDocumentNumberLabel("  ", "TK-01"), "TK-01");
  assert.equal(techCardDocumentNumberLabel(undefined, "TK-01"), "TK-01");
});

test("unitLineSizeTypeLabel localizes known size types", () => {
  assert.equal(unitLineSizeTypeLabel("men"), "Мужской");
  assert.equal(unitLineSizeTypeLabel("women"), "Женский");
  assert.equal(unitLineSizeTypeLabel(null), "—");
});

test("groupOperationLinesBySource splits routing and sewing", () => {
  const grouped = groupOperationLinesBySource([
    {
      id: 1,
      technical_card_id: 1,
      sequence: 1,
      source_kind: "routing",
      tech_operation_id: 10,
      operation_name: "Раскрой",
      volume_unit: "pieces",
      volume: "1",
      stage_order: 1,
      stage_label: "Раскрой",
      created_at: "2026-07-26T00:00:00Z",
      updated_at: "2026-07-26T00:00:00Z",
    },
    {
      id: 2,
      technical_card_id: 1,
      sequence: 2,
      source_kind: "sewing",
      tech_operation_id: null,
      sewing_operation_id: 5,
      operation_name: "Строчка",
      volume_unit: "pieces",
      volume: "1",
      stage_order: null,
      stage_label: null,
      created_at: "2026-07-26T00:00:00Z",
      updated_at: "2026-07-26T00:00:00Z",
    },
    {
      id: 3,
      technical_card_id: 1,
      sequence: 3,
      tech_operation_id: 11,
      operation_name: "Legacy op",
      volume_unit: "pieces",
      volume: "2",
      stage_order: 2,
      stage_label: "Пошив",
      created_at: "2026-07-26T00:00:00Z",
      updated_at: "2026-07-26T00:00:00Z",
    },
  ]);
  assert.equal(grouped.routing.length, 2);
  assert.equal(grouped.sewing.length, 1);
  assert.equal(grouped.routing[0].operation_name, "Раскрой");
  assert.equal(grouped.routing[1].operation_name, "Legacy op");
  assert.equal(grouped.sewing[0].operation_name, "Строчка");
});

test("materialDraftsFromComposition keeps only material rows", () => {
  const drafts = materialDraftsFromComposition([
    {
      id: 1,
      line_kind: "material",
      nomenclature_id: 10,
      snapshot_name: "Ткань",
      planned_qty: "1.5",
      unit: "м",
      notes: "Норма модели не найдена",
    },
    {
      id: 2,
      line_kind: "pattern",
      nomenclature_id: null,
      snapshot_name: "Лекала",
      planned_qty: null,
      unit: null,
    },
  ]);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].nomenclature_id, 10);
  assert.equal(drafts[0].snapshot_name, "Ткань");
  assert.equal(drafts[0].quantity, "1.5");
  assert.equal(drafts[0].notes, "Норма модели не найдена");
});

test("buildCompositionReplaceLines preserves pattern/note and rebuilds materials", () => {
  const lines = buildCompositionReplaceLines(
    [
      {
        line_kind: "material",
        nomenclature_id: 1,
        snapshot_name: "Old",
        planned_qty: "1",
        unit: "шт",
        notes: null,
      },
      {
        line_kind: "pattern",
        nomenclature_id: null,
        snapshot_name: "Лекала A",
        planned_qty: null,
        unit: null,
        notes: "/patterns",
      },
    ],
    [
      {
        key: "a",
        nomenclature_id: 22,
        snapshot_name: "Сублимация",
        quantity: "2",
        fact_qty: "",
        unit: "м",
        production_stage_id: null,
        notes: "Норма модели не найдена",
      },
      {
        key: "b",
        nomenclature_id: null,
        snapshot_name: "",
        quantity: "",
        fact_qty: "",
        unit: "",
        production_stage_id: null,
        notes: "",
      },
    ],
  );
  assert.deepEqual(
    lines.map((row) => ({
      sequence: row.sequence,
      kind: row.line_kind,
      name: row.snapshot_name,
      nom: row.nomenclature_id,
      planned: row.planned_qty,
    })),
    [
      { sequence: 1, kind: "material", name: "Сублимация", nom: 22, planned: "2" },
      { sequence: 2, kind: "pattern", name: "Лекала A", nom: null, planned: null },
    ],
  );
  assert.equal(lines[0].notes, "Норма модели не найдена");
});

test("buildTechCardHistoryEntries builds lifecycle and stage items", () => {
  const entries = buildTechCardHistoryEntries({
    id: 1,
    sales_order_id: 1,
    sales_order_item_id: 1,
    number: "TK-01",
    card_seq: 1,
    status: "in_progress",
    quantity: "2",
    nomenclature_id: 1,
    nomenclature_name: "Футболка",
    product_model_id: 1,
    product_model_article: "A-1",
    product_model_name: "Модель",
    current_stage_order: 1,
    current_stage_label: "Печать",
    order_number: "SO-1",
    unit_lines: [],
    stage_results: [
      {
        id: 10,
        technical_card_id: 1,
        stage_order: 1,
        stage_label: "Печать",
        status: "completed",
        performer_name: "Иван",
        started_at: "2026-07-28T09:00:00Z",
        completed_at: "2026-07-28T10:00:00Z",
        scrap_qty: null,
        rework_qty: null,
        notes: "Готово",
        created_at: "2026-07-28T09:00:00Z",
        updated_at: "2026-07-28T10:00:00Z",
      },
    ],
    created_at: "2026-07-28T08:00:00Z",
    updated_at: "2026-07-28T10:00:00Z",
  });
  assert.equal(entries[0].title, "Техкарта создана");
  assert.ok(entries.some((entry) => entry.title === "Этап начат: Печать"));
  assert.ok(entries.some((entry) => entry.title === "Этап завершён: Печать"));
});
