import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.3.10 manager ops / scheme / materials / route in tab panel, not 3-col grid", () => {
  const workspace = readFileSync(
    join(root, "components/production/tech-card-detail-workspace.tsx"),
    "utf8",
  );
  const tabsStart = workspace.indexOf("data-tech-card-doc-tabs");
  const ops = workspace.indexOf('title="Операции / объёмы"');
  assert.ok(tabsStart > 0 && ops > tabsStart);
  const tabsChunk = workspace.slice(tabsStart, workspace.indexOf('title="История"'));
  assert.ok(tabsChunk.includes("data-tech-card-doc-tab-panel"));
  assert.equal(tabsChunk.includes("grid-cols-3"), false);
  assert.equal(tabsChunk.includes("xl:grid-cols-3"), false);

  const shop = readFileSync(
    join(root, "components/production/tech-card-shop-floor-body.tsx"),
    "utf8",
  );
  assert.equal(shop.includes("data-tech-card-doc-tabs"), false);
  assert.equal(shop.includes('title="Операции / объёмы"'), false);
});
