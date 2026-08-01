import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRoutingNormRows,
  filterAvailableShopRoutingsForWhitelist,
  formatNormQty,
  parseNormQtyInput,
  validateOperationNormDraft,
  whitelistedRoutingTemplateIds,
} from "./product-model-routings.ts";

describe("product-model-routings helpers", () => {
  it("parses and formats norm qty", () => {
    assert.equal(parseNormQtyInput("0.7"), "0.7");
    assert.equal(parseNormQtyInput("0,75"), "0.75");
    assert.equal(parseNormQtyInput("-1"), null);
    assert.equal(parseNormQtyInput("1.2345"), null);
    assert.ok(formatNormQty("0.700").includes("0"));
    assert.equal(Number(formatNormQty("0.700").replace(",", ".")), 0.7);
  });

  it("validates norm drafts", () => {
    assert.equal(
      validateOperationNormDraft({
        production_stage_id: null,
        tech_operation_id: null,
        norm_qty_per_item: "1",
        unit: "pieces",
      }),
      "Укажите цех и/или технологическую операцию",
    );
    assert.equal(
      validateOperationNormDraft({
        production_stage_id: 1,
        tech_operation_id: null,
        norm_qty_per_item: "abc",
        unit: "pieces",
      }),
      "Норма на изделие — число ≥ 0 (до 3 знаков после запятой)",
    );
    assert.equal(
      validateOperationNormDraft({
        production_stage_id: 1,
        tech_operation_id: null,
        norm_qty_per_item: "0.7",
        unit: "   ",
      }),
      "Укажите единицу нормы",
    );
    assert.equal(
      validateOperationNormDraft({
        production_stage_id: 1,
        tech_operation_id: null,
        norm_qty_per_item: "0.7",
        unit: "linear_meters",
      }),
      null,
    );
  });

  it("filters catalog templates already linked", () => {
    const catalog = [
      { id: 1, name: "A", code: "a", is_active: true },
      { id: 2, name: "B", code: "b", is_active: true },
      { id: 3, name: "C", code: "c", is_active: false },
    ];
    const links = [
      {
        id: 10,
        product_model_id: 1,
        shop_routing_template_id: 1,
        shop_routing_template_name: "A",
        is_active: true,
        sort_order: 0,
        operation_norms: [],
        created_at: "",
        updated_at: "",
      },
      {
        id: 11,
        product_model_id: 1,
        shop_routing_template_id: 2,
        shop_routing_template_name: "B",
        is_active: false,
        sort_order: 1,
        operation_norms: [],
        created_at: "",
        updated_at: "",
      },
    ];
    const available = filterAvailableShopRoutingsForWhitelist(catalog, links);
    assert.deepEqual(
      available.map((row) => row.id),
      [],
    );
    assert.deepEqual(
      [...whitelistedRoutingTemplateIds(links)].sort(),
      [1, 2],
    );
    assert.deepEqual(
      [...whitelistedRoutingTemplateIds(links, { activeOnly: true })],
      [1],
    );
  });

  it("builds norm rows from routing stage lines", () => {
    const rows = buildRoutingNormRows(
      [
        {
          stage_order: 2,
          production_stage_id: 30,
          stage_label: "Печать",
          tech_operation_id: 5,
        },
        {
          stage_order: 1,
          production_stage_id: 20,
          stage_label: "Раскрой",
          tech_operation_id: null,
        },
      ],
      [
        {
          id: 9,
          product_model_routing_link_id: 1,
          production_stage_id: 30,
          tech_operation_id: 5,
          norm_qty_per_item: "0.7",
          unit: "linear_meters",
          created_at: "",
          updated_at: "",
        },
      ],
      new Map([[5, { name: "Сублимация", volume_unit: "linear_meters" }]]),
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0].stage_order, 1);
    assert.equal(rows[0].operation_label, "Раскрой");
    assert.equal(rows[0].norm_qty_per_item, "");
    assert.equal(rows[1].operation_label, "Печать · Сублимация");
    assert.equal(rows[1].norm_qty_per_item, "0.7");
  });
});
