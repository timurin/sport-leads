import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.3.6 order-data edit uses PlatformUser responsible combobox", () => {
  const card = readFileSync(
    join(root, "components/production/tech-card-order-data-card.tsx"),
    "utf8",
  );
  assert.ok(card.includes("data-tech-card-responsible-combobox"));
  assert.ok(card.includes('role="combobox"'));
  assert.ok(card.includes("listTechnicalCardResponsibleCandidates"));
  assert.ok(card.includes("updateTechnicalCardResponsibleAction"));
  assert.ok(card.includes("created_by_platform_user_id"));
  assert.ok(card.includes("responsible_platform_user_id"));
  assert.ok(card.includes("readOnly"));
  assert.ok(card.includes("Клиент"));
  assert.ok(card.includes("Дата сдачи"));

  const actions = readFileSync(
    join(root, "app/(workspace)/production/tech-cards/tech-card-actions.ts"),
    "utf8",
  );
  assert.ok(actions.includes("/technical-cards/responsible-candidates"));
  assert.ok(actions.includes("/responsible"));
  assert.ok(actions.includes("sessionAuthHeaders"));

  const shop = readFileSync(
    join(root, "components/production/tech-card-shop-floor-body.tsx"),
    "utf8",
  );
  assert.equal(shop.includes("data-tech-card-responsible-combobox"), false);
});
