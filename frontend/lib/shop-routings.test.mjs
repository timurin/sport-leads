import assert from "node:assert/strict";
import test from "node:test";

import {
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
