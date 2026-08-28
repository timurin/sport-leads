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
  assert.ok(api.includes("linkStandaloneTechnicalCard"));

  const actions = await readSource(
    "../../app/(workspace)/production/tech-cards/tech-card-actions.ts",
  );
  assert.ok(actions.includes("linkStandaloneTechnicalCardAction"));
  assert.ok(actions.includes("listOrdersForStandaloneLinkAction"));
  assert.ok(actions.includes("previewOrderTechCardsForStandaloneLinkAction"));

  const panel = await readSource(
    "../../components/production/standalone-tech-card-link-panel.tsx",
  );
  assert.ok(panel.includes("data-standalone-link-sales-order"));
  assert.ok(panel.includes("Привязать к заказу"));
  assert.ok(panel.includes("would_create"));

  const detail = await readSource(
    "../../components/production/tech-card-detail-workspace.tsx",
  );
  assert.ok(detail.includes("StandaloneTechCardLinkPanel"));
  assert.ok(detail.includes("!hasSalesOrder"));
});
