import assert from "node:assert/strict";
import test from "node:test";

import { findCharacteristicByName } from "../../lib/nomenclature.ts";

const definitions = [
  {
    id: 1,
    code: "color",
    name: "Цвет",
    kind: "COLOR",
    description: null,
    unit_id: null,
    is_variant_dimension: true,
    is_searchable: true,
    is_filterable: true,
    is_visible: true,
    is_active: true,
    is_system: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: 5,
    code: "brand",
    name: "Бренд",
    kind: "STRING",
    description: null,
    unit_id: null,
    is_variant_dimension: false,
    is_searchable: true,
    is_filterable: true,
    is_visible: true,
    is_active: true,
    is_system: false,
    created_at: "",
    updated_at: "",
  },
];

test("findCharacteristicByName matches variant dimensions in handbook", () => {
  const match = findCharacteristicByName(definitions, "цвет");
  assert.ok(match);
  assert.equal(match.id, 1);
  assert.equal(match.is_variant_dimension, true);
});

test("findCharacteristicByName matches non-variant attributes", () => {
  const match = findCharacteristicByName(definitions, "Бренд");
  assert.ok(match);
  assert.equal(match.id, 5);
  assert.equal(match.is_variant_dimension, false);
});

test("findCharacteristicByName returns null when missing", () => {
  assert.equal(findCharacteristicByName(definitions, "Материал"), null);
});
