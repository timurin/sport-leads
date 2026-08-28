import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.3.9 model-route edit uses catalog typeahead, assembly select, keeps routing Select", () => {
  const card = readFileSync(
    join(root, "components/production/tech-card-model-route-card.tsx"),
    "utf8",
  );
  assert.ok(card.includes('title="Модель и маршрут"'));
  assert.ok(card.includes("data-tech-card-model-route-chrome"));
  assert.ok(card.includes("data-tech-card-model-combobox"));
  assert.ok(card.includes("data-tech-card-assembly-select"));
  assert.ok(card.includes("data-tech-card-routing-select"));
  assert.ok(card.includes("listTechnicalCardModelCandidates"));
  assert.ok(card.includes("listTechnicalCardAssemblyCandidates"));
  assert.ok(card.includes("updateTechnicalCardModelAssemblyAction"));
  assert.ok(card.includes("onApplyRouting"));
  assert.ok(card.includes("<Pencil"));

  const actions = readFileSync(
    join(root, "app/(workspace)/production/tech-cards/tech-card-actions.ts"),
    "utf8",
  );
  assert.ok(actions.includes("/product-models?"));
  assert.ok(actions.includes("/assembly-variants?active_only=true"));
  assert.ok(actions.includes("/technical-cards/${cardId}/model-assembly"));
  assert.ok(actions.includes("sessionAuthHeaders"));

  const workspace = readFileSync(
    join(root, "components/production/tech-card-detail-workspace.tsx"),
    "utf8",
  );
  assert.ok(workspace.includes("<TechCardModelRouteCard"));
  assert.equal(workspace.includes("data-tech-card-routing-select"), false);

  const shop = readFileSync(
    join(root, "components/production/tech-card-shop-floor-body.tsx"),
    "utf8",
  );
  assert.equal(shop.includes("data-tech-card-model-combobox"), false);
  assert.equal(shop.includes("TechCardModelRouteCard"), false);
});
