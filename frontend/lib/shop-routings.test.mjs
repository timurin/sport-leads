import assert from "node:assert/strict";
import test from "node:test";

import {
  buildShopRoutingCopyDraft,
  filterShopRoutings,
  parseShopRoutingRouteId,
  shopRoutingStageCount,
  validateShopRoutingCreateDraft,
} from "./shop-routings.ts";

test("parseShopRoutingRouteId accepts positive integers only", () => {
  assert.equal(parseShopRoutingRouteId("12"), 12);
  assert.equal(parseShopRoutingRouteId("0"), null);
  assert.equal(parseShopRoutingRouteId("abc"), null);
});

test("shopRoutingStageCount counts stage lines", () => {
  assert.equal(
    shopRoutingStageCount({
      id: 1,
      name: "Маршрут A",
      code: "A",
      is_active: true,
      notes: null,
      stage_lines: [
        {
          id: 1,
          routing_template_id: 1,
          stage_order: 1,
          production_stage_id: 1,
          stage_label: "Раскрой",
          tech_operation_id: null,
          work_center_id: null,
          is_quality_checkpoint: false,
          created_at: "",
          updated_at: "",
        },
      ],
      created_at: "",
      updated_at: "",
    }),
    1,
  );
});

test("validateShopRoutingCreateDraft requires name and at least one stage", () => {
  assert.equal(
    validateShopRoutingCreateDraft({
      name: "",
      code: "",
      is_active: true,
      stages: [],
    }),
    "Укажите наименование маршрута",
  );
  assert.equal(
    validateShopRoutingCreateDraft({
      name: "Основной",
      code: "MAIN",
      is_active: true,
      stages: [
        {
          stage_order: 1,
          production_stage_id: 1,
          stage_label: "Раскрой",
          tech_operation_id: null,
          work_center_id: null,
          is_quality_checkpoint: false,
        },
      ],
    }),
    null,
  );
});

test("filterShopRoutings matches name and code", () => {
  const rows = [
    {
      id: 1,
      name: "Основной",
      code: "MAIN",
      is_active: true,
      notes: null,
      stage_lines: [],
      created_at: "",
      updated_at: "",
    },
    {
      id: 2,
      name: "Экспресс",
      code: null,
      is_active: false,
      notes: null,
      stage_lines: [],
      created_at: "",
      updated_at: "",
    },
  ];
  assert.equal(filterShopRoutings(rows, "main").length, 1);
  assert.equal(filterShopRoutings(rows, "эксп").length, 1);
});

test("buildShopRoutingCopyDraft clones stages with copy name and cleared code", () => {
  const draft = buildShopRoutingCopyDraft({
    id: 7,
    name: "Основной",
    code: "MAIN",
    is_active: true,
    notes: null,
    stage_lines: [
      {
        id: 1,
        routing_template_id: 7,
        stage_order: 2,
        production_stage_id: 3,
        stage_label: "Печать",
        tech_operation_id: 9,
        work_center_id: null,
        is_quality_checkpoint: true,
        created_at: "",
        updated_at: "",
      },
      {
        id: 2,
        routing_template_id: 7,
        stage_order: 1,
        production_stage_id: 1,
        stage_label: "Раскрой",
        tech_operation_id: null,
        work_center_id: null,
        is_quality_checkpoint: false,
        created_at: "",
        updated_at: "",
      },
    ],
    created_at: "",
    updated_at: "",
  });
  assert.equal(draft.name, "Основной (копия)");
  assert.equal(draft.code, "");
  assert.equal(draft.is_active, true);
  assert.equal(draft.stages.length, 2);
  assert.equal(draft.stages[0].stage_order, 1);
  assert.equal(draft.stages[0].production_stage_id, 1);
  assert.equal(draft.stages[1].stage_order, 2);
  assert.equal(draft.stages[1].tech_operation_id, 9);
  assert.equal(validateShopRoutingCreateDraft(draft), null);
});
