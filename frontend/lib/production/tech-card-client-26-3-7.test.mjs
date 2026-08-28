import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.3.7 order-data edit uses client typeahead and create modal", () => {
  const card = readFileSync(
    join(root, "components/production/tech-card-order-data-card.tsx"),
    "utf8",
  );
  assert.ok(card.includes("data-tech-card-client-combobox"));
  assert.ok(card.includes("data-tech-card-client-create"));
  assert.ok(card.includes("listTechnicalCardClientCandidates"));
  assert.ok(card.includes("updateTechnicalCardClientAction"));
  assert.ok(card.includes("ClientCreateDrawer"));
  assert.ok(card.includes("onCreated"));
  assert.ok(card.includes("Дата сдачи"));
  assert.ok(card.includes("readOnly"));

  const actions = readFileSync(
    join(root, "app/(workspace)/production/tech-cards/tech-card-actions.ts"),
    "utf8",
  );
  assert.ok(actions.includes("/technical-cards/${cardId}/client"));
  assert.ok(actions.includes("/clients?"));

  const drawer = readFileSync(
    join(root, "components/sales/client-create-drawer.tsx"),
    "utf8",
  );
  assert.ok(drawer.includes("onCreated"));
  assert.ok(drawer.includes("initialContactName"));

  const shop = readFileSync(
    join(root, "components/production/tech-card-shop-floor-body.tsx"),
    "utf8",
  );
  assert.equal(shop.includes("data-tech-card-client-combobox"), false);
});
