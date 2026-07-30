import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("warehouse stock wires nomenclature import toolbar + drawer", () => {
  const workspace = readFileSync(
    join(root, "components/warehouse/warehouse-nomenclature-workspace.tsx"),
    "utf8",
  );
  assert.ok(workspace.includes("NomenclatureImportDrawer"));
  assert.ok(workspace.includes("Импорт"));
  assert.ok(workspace.includes("setImportOpen"));

  const drawer = readFileSync(
    join(root, "components/warehouse/nomenclature-import-drawer.tsx"),
    "utf8",
  );
  assert.ok(drawer.includes("importNomenclaturesFile"));
  assert.ok(drawer.includes("Проверить"));
  assert.ok(drawer.includes("Загрузить"));

  const actions = readFileSync(
    join(
      root,
      "app/(workspace)/settings/catalogs/nomenclature/nomenclature-actions.ts",
    ),
    "utf8",
  );
  assert.ok(actions.includes("export async function importNomenclaturesFile"));
  assert.ok(actions.includes("/nomenclatures/import"));
});
