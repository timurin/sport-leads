import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.3.1 ADR-026 collab is a sticky xl rail / collapse; not inside shop-floor mockup", () => {
  const workspace = readFileSync(
    join(root, "components/production/tech-card-detail-workspace.tsx"),
    "utf8",
  );
  assert.ok(workspace.includes("data-tech-card-doc-layout=\"manager\""));
  assert.ok(workspace.includes("data-tech-card-doc-layout=\"shop\""));
  assert.ok(workspace.includes("data-tech-card-collab-rail"));
  assert.ok(workspace.includes("data-tech-card-collab-collapse"));
  assert.ok(workspace.includes("<summary"));
  assert.ok(workspace.includes("Переписка"));
  assert.ok(workspace.includes("OrderCollaborationPanel"));

  const shop = readFileSync(
    join(root, "components/production/tech-card-shop-floor-body.tsx"),
    "utf8",
  );
  assert.equal(shop.includes("OrderCollaborationPanel"), false);

  const css = readFileSync(join(root, "app/globals.css"), "utf8");
  assert.ok(css.includes(".tech-card-doc-layout"));
  assert.ok(css.includes("position: sticky"));
  assert.ok(css.includes("min-width: 1280px"));
  assert.ok(css.includes("min-width: 768px"));
  assert.ok(workspace.includes("order-1 md:order-2"));
  assert.ok(workspace.includes("xl:sticky"));
});
