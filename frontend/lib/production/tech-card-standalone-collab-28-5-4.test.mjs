import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("standalone tech-card collab rail wiring (28.5.4)", () => {
  const workspace = readFileSync(
    join(root, "components/production/tech-card-detail-workspace.tsx"),
    "utf8",
  );
  assert.ok(workspace.includes("standaloneCardId={card.id}"));
  assert.ok(workspace.includes("data-standalone-tech-card-collab"));
  assert.ok(workspace.includes("showCollabRail"));
  const row1Idx = workspace.indexOf('className="tech-card-doc-row1');
  const orderDataIdx = workspace.indexOf("<TechCardOrderDataCard");
  const collabIdx = workspace.indexOf("<TechCardOrderCollaboration card={card} surface=\"manager\"");
  assert.ok(row1Idx > 0 && orderDataIdx > row1Idx && orderDataIdx < collabIdx);
  assert.equal(workspace.includes("StandaloneTechCardLinkPanel"), false);

  const panel = readFileSync(
    join(root, "components/sales/order-collaboration-panel.tsx"),
    "utf8",
  );
  assert.ok(panel.includes("standaloneCardId"));
  assert.ok(panel.includes("listStandaloneTechCardCollaborationMessages"));

  const actions = readFileSync(
    join(root, "app/(workspace)/sales/orders/[orderId]/collaboration-actions.ts"),
    "utf8",
  );
  assert.ok(actions.includes("/technical-cards/${cardId}/collaboration/messages"));
});
