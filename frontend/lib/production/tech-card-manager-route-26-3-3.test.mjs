import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("manager route is one plan block; stage fact buttons are not on the card", () => {
  const workspace = readFileSync(
    join(root, "components/production/tech-card-detail-workspace.tsx"),
    "utf8",
  );
  const process = readFileSync(
    join(root, "components/production/tech-card-process.tsx"),
    "utf8",
  );
  const shop = readFileSync(
    join(root, "components/production/tech-card-shop-floor-body.tsx"),
    "utf8",
  );
  assert.equal(workspace.includes("data-tech-card-manager-route"), false);
  assert.equal(workspace.includes("StageTimelineRow"), false);
  assert.equal(workspace.includes("Начать этап"), false);
  assert.equal(workspace.includes("Завершить этап"), false);
  assert.ok(workspace.includes("<TechCardProcess"));
  assert.equal(workspace.includes("<TechCardRouteVariants"), false);
  assert.ok(process.includes("data-tech-card-route-map"));
  assert.ok(process.includes("data-tech-card-route-count"));
  assert.ok(process.includes("Изменить даты"));
  assert.ok(process.includes("flex-col"));
  assert.ok(process.includes("md:flex-wrap"));
  assert.ok(process.includes("xl:flex-nowrap"));
  assert.equal(shop.includes("Начать этап"), false);
  assert.equal(shop.includes("Завершить этап"), false);
  assert.equal(shop.includes("data-tech-card-manager-route"), false);
});
