import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("warehouse nomenclature bulk archive/restore (4.3.3.4)", () => {
  const actions = readFileSync(
    join(
      root,
      "app/(workspace)/settings/catalogs/nomenclature/nomenclature-actions.ts",
    ),
    "utf8",
  );
  assert.ok(actions.includes("bulkSetNomenclatureActive"));
  assert.ok(actions.includes("setNomenclatureActive"));

  const workspace = readFileSync(
    join(root, "components/warehouse/warehouse-nomenclature-workspace.tsx"),
    "utf8",
  );
  assert.ok(workspace.includes("bulkSetNomenclatureActive"));
  assert.ok(workspace.includes("selectedIds"));
  assert.ok(workspace.includes("В архив"));
  assert.ok(workspace.includes("Восстановить"));
  assert.ok(workspace.includes("Выбрать все видимые"));
});
