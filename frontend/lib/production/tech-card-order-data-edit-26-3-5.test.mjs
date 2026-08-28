import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.3.5 order-data block has edit / cancel / save icon chrome", () => {
  const card = readFileSync(
    join(root, "components/production/tech-card-order-data-card.tsx"),
    "utf8",
  );
  assert.ok(card.includes('title="Данные по заказу"'));
  assert.ok(card.includes("data-tech-card-order-data-chrome"));
  assert.ok(card.includes("data-tech-card-order-data-edit"));
  assert.ok(card.includes("data-tech-card-order-data-cancel"));
  assert.ok(card.includes("data-tech-card-order-data-save"));
  assert.ok(card.includes("<Pencil"));
  assert.ok(card.includes("<X"));
  assert.ok(card.includes("<Save"));
  assert.ok(card.includes("data-tech-card-order-data-editing"));

  const workspace = readFileSync(
    join(root, "components/production/tech-card-detail-workspace.tsx"),
    "utf8",
  );
  const mockup = workspace.indexOf('title="Макет"');
  const orderData = workspace.indexOf("<TechCardOrderDataCard");
  const model = workspace.indexOf("<TechCardModelRouteCard");
  assert.ok(mockup > 0 && mockup < orderData && orderData < model);

  const shop = readFileSync(
    join(root, "components/production/tech-card-shop-floor-body.tsx"),
    "utf8",
  );
  assert.equal(shop.includes("TechCardOrderDataCard"), false);
  assert.equal(shop.includes("data-tech-card-order-data-chrome"), false);
});
