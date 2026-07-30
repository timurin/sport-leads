import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("warehouse stock wires nomenclature export + import template", () => {
  const workspace = readFileSync(
    join(root, "components/warehouse/warehouse-nomenclature-workspace.tsx"),
    "utf8",
  );
  assert.ok(workspace.includes("downloadNomenclatureExport"));
  assert.ok(workspace.includes("Экспорт"));
  assert.ok(workspace.includes("NomenclatureImportDrawer"));

  const drawer = readFileSync(
    join(root, "components/warehouse/nomenclature-import-drawer.tsx"),
    "utf8",
  );
  assert.ok(drawer.includes("downloadNomenclatureImportTemplate"));
  assert.ok(drawer.includes("product_type_name"));
  assert.ok(drawer.includes("product_model_articles"));
  assert.ok(drawer.includes("photo_paths"));
  assert.ok(drawer.includes("char:код"));
  assert.ok(drawer.includes("через «|»"));

  const actions = readFileSync(
    join(
      root,
      "app/(workspace)/settings/catalogs/nomenclature/nomenclature-actions.ts",
    ),
    "utf8",
  );
  assert.ok(actions.includes("downloadNomenclatureExport"));
  assert.ok(actions.includes("/nomenclatures/export"));
  assert.ok(actions.includes("/nomenclatures/import-template"));
});
