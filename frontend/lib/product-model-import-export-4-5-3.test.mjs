import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("product-models list wires import/export toolbar actions", () => {
  const workspace = readFileSync(
    join(root, "components/settings/product-models-workspace.tsx"),
    "utf8",
  );
  assert.ok(workspace.includes("downloadProductModelExport"));
  assert.ok(workspace.includes("Экспорт"));
  assert.ok(workspace.includes("Импорт"));
  assert.ok(workspace.includes("ProductModelImportDrawer"));

  const drawer = readFileSync(
    join(root, "components/settings/product-model-import-drawer.tsx"),
    "utf8",
  );
  assert.ok(drawer.includes("downloadProductModelImportTemplate"));
  assert.ok(drawer.includes("Шаблон CSV"));
  assert.ok(drawer.includes("article"));
  assert.ok(drawer.includes("assembly_variant_ids"));
  assert.ok(drawer.includes("routing_template_ids"));
  assert.ok(drawer.includes("photo_paths"));

  const actions = readFileSync(
    join(
      root,
      "app/(workspace)/settings/catalogs/product-models/product-model-actions.ts",
    ),
    "utf8",
  );
  assert.ok(actions.includes("/product-models/export"));
  assert.ok(actions.includes("/import-template"));
  assert.ok(actions.includes("/product-models/import"));
});
