import assert from "node:assert/strict";
import test from "node:test";

import {
  buildShopStageKanbanColumns,
  buildShopStageModulesFromCatalog,
  getShopStageModule,
  isAllowedShopStageKanbanMove,
  shopStageCardHref,
  shopStageCodeByTitle,
  shopStageFinishedGoodsHint,
  shopStageIsFinishedGoods,
  shopStageRequiresMaterialFact,
  shopStageTransitionKind,
  SHOP_STAGE_MODULES,
} from "./shop-stage-modules.ts";

test("SHOP_STAGE_MODULES seed covers all seven цеха in ADR order", () => {
  assert.deepEqual(
    SHOP_STAGE_MODULES.map((stage) => stage.code),
    [
      "design",
      "cutting",
      "print",
      "sewing",
      "wto",
      "qc",
      "packaging",
      "ready_to_ship",
      "shipped",
    ],
  );
});

test("buildShopStageModulesFromCatalog follows ProductionStage sort_order", () => {
  const modules = buildShopStageModulesFromCatalog([
    { code: "design", name: "Дизайн", sort_order: 10, is_active: true, id: 1 },
    { code: "print", name: "Печать", sort_order: 20, is_active: true, id: 3 },
    { code: "cutting", name: "Раскрой", sort_order: 30, is_active: true, id: 2 },
    { code: "sewing", name: "Пошив", sort_order: 40, is_active: true, id: 4 },
    { code: "qc", name: "Контроль качества", sort_order: 60, is_active: true, id: 6 },
    { code: "wto", name: "ВТО", sort_order: 50, is_active: false, id: 5 },
  ]);
  assert.deepEqual(
    modules.map((stage) => stage.code),
    ["design", "print", "cutting", "sewing", "qc"],
  );
  assert.equal(modules.find((stage) => stage.code === "qc")?.title, "Контроль качества");
  assert.equal(
    shopStageTransitionKind("design", "print", modules),
    "forward",
  );
  assert.equal(
    shopStageTransitionKind("design", "cutting", modules),
    null,
  );
});

test("buildShopStageModulesFromCatalog includes unknown active codes", () => {
  const modules = buildShopStageModulesFromCatalog([
    { code: "custom-step", name: "Кастом", sort_order: 10, is_active: true, id: 1 },
  ]);
  assert.deepEqual(modules.map((stage) => stage.code), ["custom-step"]);
  assert.equal(modules[0].href, "/production/stages/custom-step");
  assert.equal(modules[0].title, "Кастом");
});

test("buildShopStageModulesFromCatalog returns empty when catalog has only inactive rows", () => {
  const modules = buildShopStageModulesFromCatalog([
    { code: "design", name: "Дизайн", sort_order: 10, is_active: false, id: 1 },
    { code: "print", name: "Печать", sort_order: 20, is_active: false, id: 2 },
  ]);
  assert.deepEqual(modules, []);
});

test("getShopStageModule resolves known codes and rejects unknown", () => {
  assert.equal(getShopStageModule("cutting")?.title, "Раскрой");
  assert.equal(getShopStageModule("print")?.href, "/production/stages/print");
  assert.equal(getShopStageModule("quality"), null);
});

test("shopStageRequiresMaterialFact is true only for cutting/print", () => {
  assert.equal(shopStageRequiresMaterialFact("cutting"), true);
  assert.equal(shopStageRequiresMaterialFact("print"), true);
  assert.equal(shopStageRequiresMaterialFact("sewing"), false);
  assert.equal(shopStageRequiresMaterialFact("design"), false);
});

test("shopStageCardHref keeps stage context on TC document URL", () => {
  assert.equal(
    shopStageCardHref("cutting", 42),
    "/production/tech-cards/42?stage=cutting",
  );
});

test("sewing shop UI routes under /production/stages/sewing", () => {
  assert.equal(getShopStageModule("sewing")?.title, "Пошив");
  assert.equal(getShopStageModule("sewing")?.href, "/production/stages/sewing");
  assert.equal(
    shopStageCardHref("sewing", 7),
    "/production/tech-cards/7?stage=sewing",
  );
  assert.equal(shopStageRequiresMaterialFact("sewing"), false);
});

test("packaging shop UI routes under /production/stages/packaging", () => {
  assert.equal(getShopStageModule("packaging")?.title, "Упаковка");
  assert.equal(
    getShopStageModule("packaging")?.href,
    "/production/stages/packaging",
  );
  assert.equal(
    shopStageCardHref("packaging", 9),
    "/production/tech-cards/9?stage=packaging",
  );
  assert.equal(shopStageRequiresMaterialFact("packaging"), false);
  assert.equal(shopStageCodeByTitle("Упаковка"), "packaging");
});

test("FG shop modules ready_to_ship and shipped (11.2.2.3)", () => {
  assert.equal(getShopStageModule("ready_to_ship")?.title, "Готовы к отгрузке");
  assert.equal(
    getShopStageModule("ready_to_ship")?.href,
    "/production/stages/ready_to_ship",
  );
  assert.equal(getShopStageModule("shipped")?.title, "Отгружены");
  assert.equal(
    getShopStageModule("shipped")?.href,
    "/production/stages/shipped",
  );
  assert.equal(
    shopStageCardHref("ready_to_ship", 3),
    "/production/tech-cards/3?stage=ready_to_ship",
  );
  assert.equal(shopStageIsFinishedGoods("ready_to_ship"), true);
  assert.equal(shopStageIsFinishedGoods("shipped"), true);
  assert.equal(shopStageIsFinishedGoods("packaging"), false);
  assert.ok(shopStageFinishedGoodsHint("ready_to_ship")?.includes("Приход"));
  assert.ok(shopStageFinishedGoodsHint("shipped")?.includes("Списание"));
  assert.equal(shopStageCodeByTitle("Готовы к отгрузке"), "ready_to_ship");
  assert.equal(shopStageCodeByTitle("Отгружены"), "shipped");
  assert.equal(shopStageTransitionKind("packaging", "ready_to_ship"), "forward");
  assert.equal(shopStageTransitionKind("ready_to_ship", "shipped"), "forward");
  assert.equal(isAllowedShopStageKanbanMove("packaging", "ready_to_ship"), true);
  assert.equal(isAllowedShopStageKanbanMove("packaging", "shipped"), false);
});

test("kanban seed includes FG columns after packaging", () => {
  const columns = buildShopStageKanbanColumns([]);
  const codes = columns.map((column) => column.id);
  assert.ok(codes.includes("ready_to_ship"));
  assert.ok(codes.includes("shipped"));
  const packagingIdx = codes.indexOf("packaging");
  const readyIdx = codes.indexOf("ready_to_ship");
  const shippedIdx = codes.indexOf("shipped");
  assert.ok(packagingIdx >= 0 && readyIdx === packagingIdx + 1);
  assert.ok(shippedIdx === readyIdx + 1);
});

test("sewing bind maps Пошив label to sewing code", () => {
  assert.equal(shopStageCodeByTitle("Пошив"), "sewing");
  assert.equal(shopStageCodeByTitle("пошив"), "sewing");
});

test("shopStageCodeByTitle maps Russian labels to codes", () => {
  assert.equal(shopStageCodeByTitle("Раскрой"), "cutting");
  assert.equal(shopStageCodeByTitle("Печать"), "print");
  assert.equal(shopStageCodeByTitle("unknown"), null);
});

test("shopStageTransitionKind allows only adjacent columns", () => {
  assert.equal(shopStageTransitionKind("cutting", "print"), "forward");
  assert.equal(shopStageTransitionKind("print", "cutting"), "backward");
  assert.equal(shopStageTransitionKind("cutting", "sewing"), null);
  assert.equal(shopStageTransitionKind("unassigned", "design"), null);
  assert.equal(isAllowedShopStageKanbanMove("design", "cutting"), true);
  assert.equal(isAllowedShopStageKanbanMove("design", "print"), false);
});

test("buildShopStageKanbanColumns groups active cards by current stage", () => {
  const columns = buildShopStageKanbanColumns([
    {
      id: 1,
      sales_order_id: 4,
      sales_order_item_id: 11,
      number: "SO-1-01",
      card_seq: 1,
      status: "in_progress",
      quantity: "2",
      nomenclature_id: 1,
      nomenclature_name: "Футболка",
      product_model_article: "213",
      product_model_name: "Модель",
      assembly_variant_name: null,
      current_stage_order: 2,
      current_stage_label: "Раскрой",
      unit_lines: [],
      created_at: "2026-07-28T00:00:00Z",
      updated_at: "2026-07-28T00:00:00Z",
      order_number: "SO-1",
    },
    {
      id: 2,
      sales_order_id: 5,
      sales_order_item_id: 21,
      number: "SO-2-01",
      card_seq: 1,
      status: "cancelled",
      quantity: "1",
      nomenclature_id: 2,
      nomenclature_name: "Шорты",
      product_model_article: null,
      product_model_name: null,
      assembly_variant_name: null,
      current_stage_order: 3,
      current_stage_label: "Печать",
      unit_lines: [],
      created_at: "2026-07-28T00:00:00Z",
      updated_at: "2026-07-28T00:00:00Z",
      order_number: "SO-2",
    },
  ]);

  const cutting = columns.find((column) => column.id === "cutting");
  assert.equal(cutting?.cards.length, 1);
  assert.equal(cutting?.cards[0]?.id, "1");
  assert.equal(cutting?.cards[0]?.href, "/production/tech-cards/1?stage=cutting");
  assert.equal(cutting?.cards[0]?.badge?.label, "Ожидает");
  assert.equal(columns.find((column) => column.id === "print")?.cards.length, 0);
});

test("shopStageCodeByTitle accepts QC catalog alias", () => {
  assert.equal(shopStageCodeByTitle("Контроль качества"), "qc");
  assert.equal(shopStageCodeByTitle("ОТК"), "qc");
});
