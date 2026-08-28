import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.3.13 manager collab rail/collapse for contour A and B; shop mockup without chat", () => {
  const workspace = readFileSync(
    join(root, "components/production/tech-card-detail-workspace.tsx"),
    "utf8",
  );
  assert.ok(workspace.includes("function TechCardOrderCollaboration"));
  assert.ok(workspace.includes("standaloneCardId={card.id}"));
  assert.ok(workspace.includes("orderId={card.sales_order_id}"));
  assert.ok(workspace.includes("technicalCardId={card.id}"));
  assert.ok(workspace.includes("data-tech-card-collab-rail"));
  assert.ok(workspace.includes("data-tech-card-collab-collapse"));
  assert.ok(workspace.includes("data-standalone-tech-card-collab"));
  assert.ok(workspace.includes("showCollabRail"));
  assert.ok(workspace.includes("hasSalesOrder || card.order_group_id != null"));
  assert.ok(workspace.includes('<TechCardOrderCollaboration card={card} surface="manager"'));
  assert.ok(workspace.includes('<TechCardOrderCollaboration card={card} surface="shop"'));

  const shop = readFileSync(
    join(root, "components/production/tech-card-shop-floor-body.tsx"),
    "utf8",
  );
  assert.equal(shop.includes("OrderCollaborationPanel"), false);

  const panel = readFileSync(
    join(root, "components/sales/order-collaboration-panel.tsx"),
    "utf8",
  );
  assert.ok(panel.includes("standaloneCardId"));
  assert.ok(panel.includes("createStandaloneTechCardCollaborationMessage"));

  const actions = readFileSync(
    join(root, "app/(workspace)/sales/orders/[orderId]/collaboration-actions.ts"),
    "utf8",
  );
  assert.ok(actions.includes("/technical-cards/${cardId}/collaboration/messages"));
});
