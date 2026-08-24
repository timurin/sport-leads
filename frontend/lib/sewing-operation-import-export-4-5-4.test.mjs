import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("sewing-operations list wires import/export toolbar actions", () => {
  const workspace = readFileSync(
    join(root, "components/settings/sewing-operations-workspace.tsx"),
    "utf8",
  );
  assert.ok(workspace.includes("downloadSewingOperationExport"));
  assert.ok(workspace.includes("Экспорт"));
  assert.ok(workspace.includes("Импорт"));
  assert.ok(workspace.includes("SewingOperationImportDrawer"));

  const drawer = readFileSync(
    join(root, "components/settings/sewing-operation-import-drawer.tsx"),
    "utf8",
  );
  assert.ok(drawer.includes("downloadSewingOperationImportTemplate"));
  assert.ok(drawer.includes("Шаблон CSV"));
  assert.ok(drawer.includes("folder_path"));
  assert.ok(drawer.includes("work_center_codes"));

  const actions = readFileSync(
    join(
      root,
      "app/(workspace)/settings/catalogs/sewing_operations/sewing-operation-actions.ts",
    ),
    "utf8",
  );
  assert.ok(actions.includes("/sewing-operations/export"));
  assert.ok(actions.includes("/import-template"));
  assert.ok(actions.includes("/sewing-operations/import"));
  assert.ok(actions.includes("fetchBackend"));

  const page = readFileSync(
    join(
      root,
      "app/(workspace)/settings/catalogs/sewing_operations/page.tsx",
    ),
    "utf8",
  );
  assert.ok(page.includes("retryBackendOnce"));
});
