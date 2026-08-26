import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  matchingActiveModelsForProductType,
  nomenclatureModelPickerOptions,
  sortNomenclatureAvailableModelLinks,
} from "./nomenclature-available-models.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("26.4.1 picker is product-type catalog minus whitelist; card list is links", () => {
  const models = [
    { id: 1, article: "B-2", product_type_id: 10 },
    { id: 2, article: "A-1", product_type_id: 10 },
    { id: 3, article: "C-3", product_type_id: 11 },
  ];
  const matching = matchingActiveModelsForProductType(models, 10);
  assert.deepEqual(
    matching.map((row) => row.id),
    [2, 1],
  );
  const picker = nomenclatureModelPickerOptions(models, 10, new Set([2]));
  assert.deepEqual(
    picker.map((row) => row.id),
    [1],
  );
  assert.deepEqual(nomenclatureModelPickerOptions(models, null, new Set()), []);

  const links = sortNomenclatureAvailableModelLinks([
    {
      id: 9,
      nomenclature_id: 16,
      product_model_id: 1,
      sort_order: 2,
      created_at: "",
      updated_at: "",
      article: "B-2",
      name: "B",
      size_type: "men",
      status: "active",
    },
    {
      id: 8,
      nomenclature_id: 16,
      product_model_id: 2,
      sort_order: 1,
      created_at: "",
      updated_at: "",
      article: "A-1",
      name: "A",
      size_type: "men",
      status: "active",
    },
  ]);
  assert.deepEqual(
    links.map((row) => row.product_model_id),
    [2, 1],
  );

  const block = readFileSync(
    join(root, "components/settings/nomenclature-available-models-block.tsx"),
    "utf8",
  );
  assert.ok(block.includes("sortNomenclatureAvailableModelLinks"));
  assert.ok(block.includes("nomenclatureModelPickerOptions"));
  assert.ok(!block.includes("matchingModels.map"));
});
