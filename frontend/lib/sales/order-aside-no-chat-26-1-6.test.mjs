import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.1.6 order aside has no Переписка tab; chat stays on Коммуникация filter", () => {
  const page = readFileSync(
    join(root, "components/sales/sales-order-page.tsx"),
    "utf8",
  );
  assert.equal(page.includes('id: "chat"'), false);
  assert.equal(page.includes('label: "Переписка"'), false);
  assert.ok(page.includes('id="order-workspace-panel-communication"'));
  assert.ok(page.includes("visibility.communication"));
  assert.ok(page.includes("OrderCollaborationPanel"));

  const modes = readFileSync(
    join(root, "lib/sales/order-card-view-mode.ts"),
    "utf8",
  );
  assert.ok(modes.includes('{ id: "communication", label: "Коммуникация" }'));
});

test("26.1.6 ADR-026 collaboration stays on the tech-card document", () => {
  const techCard = readFileSync(
    join(root, "components/production/tech-card-detail-workspace.tsx"),
    "utf8",
  );
  assert.ok(techCard.includes("OrderCollaborationPanel"));
  assert.ok(techCard.includes("Переписка ·"));
});
