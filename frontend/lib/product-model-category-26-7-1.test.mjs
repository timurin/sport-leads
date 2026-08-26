import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("26.7.1 product-model card has category folder Select; PATCH sends folder_id", () => {
  const card = readFileSync(
    join(root, "components/settings/product-model-persistent-card.tsx"),
    "utf8",
  );
  assert.ok(card.includes('label="Категория"'));
  assert.ok(card.includes('aria-label="Категория"'));
  assert.ok(card.includes("Без папки"));
  assert.ok(card.includes("productModelFolderSelectOptions"));
  assert.ok(card.includes("folder_id: draft.folder_id"));
  assert.ok(card.includes('label="Вид изделия"'));
  assert.ok(card.includes('label="Маршрут по умолчанию"'));

  const page = readFileSync(
    join(
      root,
      "app/(workspace)/settings/catalogs/product-models/[modelId]/page.tsx",
    ),
    "utf8",
  );
  assert.ok(page.includes("getProductModelFolders"));
  assert.ok(page.includes("catalogFolders"));

  const actions = readFileSync(
    join(
      root,
      "app/(workspace)/settings/catalogs/product-models/product-model-actions.ts",
    ),
    "utf8",
  );
  const patch = actions.slice(actions.indexOf("export async function updateProductModelRequisites"));
  assert.ok(patch.includes("folder_id: payload.folder_id"));
});
