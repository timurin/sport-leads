import assert from "node:assert/strict";
import test from "node:test";

import {
  buildShopRoutingCopyDraft,
  buildWorkCenterCatalogTreeRows,
  filterShopRoutings,
  filterWorkCenters,
  parseShopRoutingRouteId,
  shopRoutingStageCount,
  validateShopRoutingCreateDraft,
  visibleWorkCenterCatalogTreeRows,
  WORK_CENTER_UNASSIGNED_FOLDER_ID,
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

test("filterWorkCenters matches name and code", () => {
  const rows = [
    {
      id: 1,
      name: "Раскройный стол",
      code: "CUT-01",
      production_stage_id: 1,
      is_active: true,
      created_at: "",
      updated_at: "",
    },
    {
      id: 2,
      name: "Швейная машина",
      code: "SEW-01",
      production_stage_id: 2,
      is_active: true,
      created_at: "",
      updated_at: "",
    },
  ];
  assert.equal(filterWorkCenters(rows, "раскрой").length, 1);
  assert.equal(filterWorkCenters(rows, "SEW").length, 1);
  assert.equal(filterWorkCenters(rows, "").length, 2);
});

test("buildWorkCenterCatalogTreeRows groups equipment under stages", () => {
  const stages = [
    { id: 2, name: "Пошив", sort_order: 2 },
    { id: 1, name: "Раскрой", sort_order: 1 },
  ];
  const workCenters = [
    {
      id: 10,
      name: "Стол B",
      code: "B",
      production_stage_id: 1,
      is_active: true,
      created_at: "",
      updated_at: "",
    },
    {
      id: 11,
      name: "Стол A",
      code: "A",
      production_stage_id: 1,
      is_active: true,
      created_at: "",
      updated_at: "",
    },
    {
      id: 12,
      name: "Без привязки",
      code: "X",
      production_stage_id: null,
      is_active: true,
      created_at: "",
      updated_at: "",
    },
  ];
  const tree = buildWorkCenterCatalogTreeRows(stages, workCenters);
  assert.equal(tree[0].kind, "folder");
  assert.equal(tree[0].id, 1);
  assert.equal(tree[1].kind, "work_center");
  assert.equal(tree[1].name, "Стол A");
  assert.equal(tree[2].name, "Стол B");
  assert.equal(tree[3].kind, "folder");
  assert.equal(tree[3].id, 2);
  const unassigned = tree.find(
    (row) =>
      row.kind === "folder" && row.id === WORK_CENTER_UNASSIGNED_FOLDER_ID,
  );
  assert.ok(unassigned);
  assert.equal(unassigned.name, "Без цеха");
  const orphan = tree.find(
    (row) => row.kind === "work_center" && row.id === 12,
  );
  assert.ok(orphan);
  assert.equal(orphan.parent_id, WORK_CENTER_UNASSIGNED_FOLDER_ID);
});

test("visibleWorkCenterCatalogTreeRows respects expanded folders", () => {
  const tree = buildWorkCenterCatalogTreeRows(
    [{ id: 1, name: "Раскрой", sort_order: 1 }],
    [
      {
        id: 10,
        name: "Стол",
        code: "A",
        production_stage_id: 1,
        is_active: true,
        created_at: "",
        updated_at: "",
      },
    ],
  );
  const collapsed = visibleWorkCenterCatalogTreeRows(tree, new Set());
  assert.equal(
    collapsed.filter((row) => row.kind === "work_center").length,
    0,
  );
  const expanded = visibleWorkCenterCatalogTreeRows(tree, new Set([1]));
  assert.equal(
    expanded.filter((row) => row.kind === "work_center").length,
    1,
  );
});
