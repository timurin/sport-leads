import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTechnicalCardPrintRequest,
  TECH_CARD_PRINT_TEMPLATE_SOURCE,
} from "./tech-card-print.ts";

test("buildTechnicalCardPrintRequest maps technical card to registry payload", () => {
  const request = buildTechnicalCardPrintRequest({
    id: 42,
    sales_order_id: 11,
    sales_order_item_id: 77,
    number: "SO-42-01",
    card_seq: 1,
    status: "in_progress",
    quantity: "24",
    nomenclature_id: 5,
    nomenclature_name: "Игровая футболка",
    product_model_id: 8,
    product_model_article: "PM-001",
    product_model_name: "Футболка PRO",
    product_model_size_type: "male",
    product_model_cover_image_url: "/product-models/8/media/3/content",
    assembly_variant_name: "Основная сборка",
    assembly_variant_total_cost: "150.50",
    current_stage_order: 3,
    current_stage_label: "Печать",
    design_mockup_url: "https://cdn.test/mockup.png",
    order_number: "SO-42",
    client_name: "ООО Тест",
    responsible_name: "Иван Петров",
    desired_date: "2026-08-15",
    unit_lines: [
      {
        id: 1,
        technical_card_id: 42,
        unit_index: 1,
        size_type: "male",
        size: "48",
        personalization: "Иванов",
        print_number: "10",
        notes: "капитан",
      },
      { id: 2, technical_card_id: 42, unit_index: 2, size_type: "male", size: "48" },
      { id: 3, technical_card_id: 42, unit_index: 3, size_type: "male", size: "50" },
      { id: 4, technical_card_id: 42, unit_index: 4, size_type: "female", size: "44" },
    ],
    composition_lines: [
      {
        id: 10,
        technical_card_id: 42,
        sequence: 1,
        line_kind: "material",
        nomenclature_id: 101,
        snapshot_name: "Кулирка",
        planned_qty: "12.5",
        fact_qty: "11.8",
        production_stage_id: 2,
        unit: "м",
        notes: "Основная ткань",
        created_at: "2026-08-01T10:00:00Z",
        updated_at: "2026-08-01T10:00:00Z",
      },
      {
        id: 11,
        technical_card_id: 42,
        sequence: 2,
        line_kind: "note",
        nomenclature_id: null,
        snapshot_name: "Наклейка по вороту",
        planned_qty: null,
        unit: null,
        notes: "Согласовать до печати",
        created_at: "2026-08-01T10:00:00Z",
        updated_at: "2026-08-01T10:00:00Z",
      },
    ],
    operation_lines: [
      {
        id: 21,
        technical_card_id: 42,
        sequence: 1,
        source_kind: "routing",
        tech_operation_id: 9,
        operation_name: "Печать груди",
        volume_unit: "pieces",
        volume: "24",
        stage_order: 3,
        production_stage_id: 3,
        stage_label: "Печать",
        created_at: "2026-08-01T10:00:00Z",
        updated_at: "2026-08-01T10:00:00Z",
      },
      {
        id: 22,
        technical_card_id: 42,
        sequence: 9,
        source_kind: "sewing",
        tech_operation_id: null,
        operation_name: "Втачивание рукава",
        volume_unit: "pieces",
        volume: "0",
        stage_order: 4,
        production_stage_id: 4,
        stage_label: "Пошив",
        created_at: "2026-08-01T10:00:00Z",
        updated_at: "2026-08-01T10:00:00Z",
      },
    ],
    assembly_sewing_operations: [
      {
        sequence: 1,
        operation_name: "Стачать боковой шов",
        cost: "25.00",
        quantity_per_item: 2,
        line_total: "50.00",
        duration_seconds: 90,
        sewing_operation_id: 7,
      },
    ],
    stage_results: [],
    media_items: [],
    created_at: "2026-08-01T10:00:00Z",
    updated_at: "2026-08-01T11:00:00Z",
  });

  assert.equal(request.binding_type, "model");
  assert.equal(request.binding_key, "technical_card");
  assert.equal(request.output_format, "html");
  assert.equal(request.payload.document_number, "SO-42-01");
  assert.equal(request.payload.header.status_label, "В работе");
  assert.equal(request.payload.model.product_model_label, "PM-001 · Футболка PRO");
  assert.match(
    String(request.payload.model.product_model_cover_image_url),
    /\/product-models\/8\/media\/3\/content/,
  );
  assert.equal(request.payload.size_matrix.total_units, 4);
  assert.deepEqual(request.payload.size_matrix.columns, ["48", "50", "44"]);
  assert.equal(request.payload.size_matrix.rows[0].size_type, "Мужской");
  assert.deepEqual(request.payload.size_matrix.rows[0].cells, [2, 1, 0]);
  assert.equal(request.payload.materials[0].snapshot_name, "Кулирка");
  assert.equal(request.payload.operation_volumes[0].volume_unit_label, "шт.");
  assert.equal(request.payload.operation_volumes.length, 1);
  assert.equal(request.payload.operation_volumes[0].operation_name, "Печать груди");
  assert.equal(request.payload.assembly_scheme.variant_name, "Основная сборка");
  assert.equal(request.payload.assembly_scheme.operations[0].operation_name, "Стачать боковой шов");
  assert.match(request.payload.html.mockup_block, /mockup\.png/);
  assert.match(request.payload.html.poshtuchno_block, /Фамилия/);
  assert.match(request.payload.html.poshtuchno_block, /Иванов/);
  assert.match(request.payload.html.unit_lines_table, /Тип размера/);
  assert.match(request.payload.html.size_matrix_table, /Размерная матрица|<table/);
  assert.match(request.payload.html.model_photo_block, /product-models\/8\/media\/3\/content/);
  assert.match(request.payload.html.assembly_scheme_block, /Стачать боковой шов/);
  assert.match(request.payload.html.materials_table, /Кулирка/);
  assert.match(request.payload.html.composition_notes_block, /Наклейка по вороту/);
  assert.match(request.payload.html.operation_volumes_table, /Печать груди/);
  assert.doesNotMatch(request.payload.html.operation_volumes_table, /Втачивание рукава/);
  assert.doesNotMatch(request.payload.html.operation_volumes_table, /sewing/);
  assert.equal(request.payload.unit_lines[0].personalization, "Иванов");
  assert.equal(request.payload.unit_lines[0].print_number, "10");
});

test("TECH_CARD_PRINT_TEMPLATE_SOURCE targets landscape side 1/2 layout", () => {
  assert.match(TECH_CARD_PRINT_TEMPLATE_SOURCE, /Информация о заказе/);
  assert.match(TECH_CARD_PRINT_TEMPLATE_SOURCE, /Поштучно/);
  assert.match(TECH_CARD_PRINT_TEMPLATE_SOURCE, /Схема сборки изделия/);
  assert.match(TECH_CARD_PRINT_TEMPLATE_SOURCE, /\{\{ html\.poshtuchno_block \}\}/);
  assert.match(TECH_CARD_PRINT_TEMPLATE_SOURCE, /\{\{ html\.model_photo_block \}\}/);
  assert.match(TECH_CARD_PRINT_TEMPLATE_SOURCE, /\{\{ html\.assembly_scheme_block \}\}/);
  assert.match(TECH_CARD_PRINT_TEMPLATE_SOURCE, /\{\{ html\.materials_table \}\}/);
  assert.match(TECH_CARD_PRINT_TEMPLATE_SOURCE, /\{\{ html\.operation_volumes_table \}\}/);
  assert.match(TECH_CARD_PRINT_TEMPLATE_SOURCE, /grid-template-columns:\s*3fr 7fr/);
});

test("TECH_CARD_PRINT_TEMPLATE_SOURCE uses A4 landscape with narrow margins", () => {
  assert.match(
    TECH_CARD_PRINT_TEMPLATE_SOURCE,
    /@page\s*\{\s*size:\s*A4 landscape;\s*margin:\s*8mm;\s*\}/,
  );
});

test("buildTechnicalCardPrintRequest supports pdf output", () => {
  const request = buildTechnicalCardPrintRequest(
    {
      id: 1,
      sales_order_id: 1,
      sales_order_item_id: 1,
      number: "TC-1",
      card_seq: 1,
      status: "draft",
      quantity: "1",
      nomenclature_id: 1,
      nomenclature_name: "Item",
      product_model_id: null,
      product_model_article: null,
      product_model_name: null,
      product_model_size_type: null,
      assembly_variant_name: null,
      current_stage_order: null,
      current_stage_label: null,
      design_mockup_url: null,
      order_number: "SO-1",
      client_name: null,
      responsible_name: null,
      desired_date: null,
      unit_lines: [],
      composition_lines: [],
      operation_lines: [],
      stage_results: [],
      media_items: [],
      created_at: "2026-08-03T10:00:00Z",
      updated_at: "2026-08-03T10:00:00Z",
    },
    "pdf",
  );

  assert.equal(request.output_format, "pdf");
  assert.match(request.payload.html.model_photo_block, /Фото модели не задано/);
  assert.match(request.payload.html.assembly_scheme_block, /Швейные операции сборки не заполнены/);
});
