import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.3.3 manager route is a horizontal wrap; shop chips stay in shop-floor body", () => {
  const workspace = readFileSync(
    join(root, "components/production/tech-card-detail-workspace.tsx"),
    "utf8",
  );
  const routeIdx = workspace.indexOf('title="Маршрут / участки"');
  const historyIdx = workspace.indexOf('title="История"');
  assert.ok(routeIdx > 0 && historyIdx > routeIdx);
  const managerRoute = workspace.slice(routeIdx, historyIdx);
  assert.ok(managerRoute.includes("data-tech-card-manager-route"));
  assert.ok(managerRoute.includes("flex-wrap"));
  assert.ok(managerRoute.includes("StageTimelineRow"));
  assert.equal(managerRoute.includes("space-y-portal-3"), false);

  const shop = readFileSync(
    join(root, "components/production/tech-card-shop-floor-body.tsx"),
    "utf8",
  );
  assert.ok(shop.includes('<ol className="flex flex-wrap gap-portal-2">'));
  assert.equal(shop.includes("StageTimelineRow"), false);
  assert.equal(shop.includes("data-tech-card-manager-route"), false);
});
