import assert from "node:assert/strict";
import test from "node:test";

import {
  parseSewingPeriodPreset,
  sewerMatchesQuery,
  sewingQueueCardTitle,
  sewingWorkKindLabel,
  sewingWorkStatusLabel,
} from "./sewing-cabinet.ts";

test("sewing cabinet labels and period preset", () => {
  assert.equal(sewingWorkStatusLabel("reserved"), "В резерве");
  assert.equal(sewingWorkStatusLabel("completed"), "Отшито");
  assert.equal(sewingWorkKindLabel("piece"), "Изделие");
  assert.equal(parseSewingPeriodPreset("week"), "week");
  assert.equal(parseSewingPeriodPreset("nope"), "day");
});

test("sewer list query matches name or login", () => {
  const item = {
    id: 1,
    login: "anna",
    display_name: "Анна Швея",
    photo_url: null,
    reserved_count: 2,
    earnings_completed: "10.00",
  };
  assert.equal(sewerMatchesQuery(item, "анн"), true);
  assert.equal(sewerMatchesQuery(item, "ANNA"), true);
  assert.equal(sewerMatchesQuery(item, "петр"), false);
});

test("queue card title prefers nomenclature", () => {
  assert.equal(
    sewingQueueCardTitle({
      technical_card_id: 1,
      number: "TC-1",
      nomenclature_name: "Футболка",
      product_model_name: "Модель",
      assembly_variant_name: "База",
      piece_cap: 2,
      piece_remaining: "2",
      piece_unit_price: "1",
      operations: [],
    }),
    "Футболка",
  );
});
