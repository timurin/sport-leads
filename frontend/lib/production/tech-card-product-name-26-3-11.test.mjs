import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.3.11 manager EntityHeader edits nomenclature_name; shop stays read-only", () => {
  const header = readFileSync(
    join(root, "components/production/tech-card-product-name-header.tsx"),
    "utf8",
  );
  assert.ok(header.includes("data-tech-card-product-name"));
  assert.ok(header.includes("data-tech-card-product-name-chrome"));
  assert.ok(header.includes("data-tech-card-product-name-input"));
  assert.ok(header.includes("data-tech-card-print-name-label"));
  assert.ok(header.includes("Название изделия для печати:"));
  assert.ok(header.includes("updateTechnicalCardProductNameAction"));
  assert.ok(header.includes("<Pencil"));
  assert.ok(header.includes("techCardPositionLabel"));

  const actions = readFileSync(
    join(root, "app/(workspace)/production/tech-cards/tech-card-actions.ts"),
    "utf8",
  );
  assert.ok(actions.includes("/technical-cards/${cardId}/nomenclature-name"));
  assert.ok(actions.includes("sessionAuthHeaders"));

  const workspace = readFileSync(
    join(root, "components/production/tech-card-detail-workspace.tsx"),
    "utf8",
  );
  assert.ok(workspace.includes("<TechCardProductNameHeader"));
  assert.ok(workspace.includes("allowEdit={!isShopContext}"));

  const shop = readFileSync(
    join(root, "components/production/tech-card-shop-floor-body.tsx"),
    "utf8",
  );
  assert.equal(shop.includes("data-tech-card-product-name-input"), false);
  assert.equal(shop.includes("TechCardProductNameHeader"), false);
});
