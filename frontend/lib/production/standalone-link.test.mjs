import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

async function readSource(relativeFromLib) {
  const path = fileURLToPath(new URL(relativeFromLib, import.meta.url));
  return readFile(path, "utf8");
}

test("standalone B→A link API and document panel wiring (28.5.1)", async () => {
  const api = await readSource("../sales/order-tech-cards-api.ts");
  assert.ok(api.includes("/technical-cards/${cardId}/link-sales-order-item"));
  assert.ok(api.includes("/technical-cards/order-groups/${groupId}"));
  assert.ok(api.includes("linkStandaloneTechnicalCard"));
  assert.ok(api.includes("updateTechnicalCardOrderGroup"));

  const actions = await readSource(
    "../../app/(workspace)/production/tech-cards/tech-card-actions.ts",
  );
  assert.ok(actions.includes("linkStandaloneTechnicalCardAction"));
  assert.ok(actions.includes("updateTechnicalCardOrderNumberAction"));
  assert.ok(actions.includes("listOrdersForStandaloneLinkAction"));
  assert.ok(actions.includes("previewOrderTechCardsForStandaloneLinkAction"));

  const panel = await readSource(
    "../../components/production/standalone-tech-card-link-panel.tsx",
  );
  assert.ok(panel.includes("data-standalone-link-sales-order"));
  assert.ok(panel.includes("Выбрать заказ"));
  assert.ok(panel.includes("data-tech-card-select-order"));
  assert.ok(panel.includes("data-tech-card-order-row"));
  assert.ok(panel.includes("data-tech-card-order-number"));
  assert.ok(panel.includes("text-portal-primary"));
  assert.ok(panel.includes("data-tech-card-order-select"));
  assert.ok(panel.includes("would_create"));
  assert.equal(panel.includes("Привязать к заказу"), false);
  assert.equal(panel.includes("<SectionCard"), false);

  const orderData = await readSource(
    "../../components/production/tech-card-order-data-card.tsx",
  );
  assert.ok(orderData.includes("StandaloneTechCardLinkPanel"));
  assert.ok(orderData.includes("data-tech-card-order-link"));

  const detail = await readSource(
    "../../components/production/tech-card-detail-workspace.tsx",
  );
  assert.equal(detail.includes("StandaloneTechCardLinkPanel"), false);
});
