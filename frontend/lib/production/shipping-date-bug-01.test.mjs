import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { presentPlanSummary } from "./tech-card-route-map.ts";
import { standaloneTechnicalCardCreateBody } from "../sales/order-tech-cards-api.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("BUG-01 create payload keeps shipping_date independent of desired_date", () => {
  const body = standaloneTechnicalCardCreateBody({
    nomenclatureName: "BUG-01 test",
    orderNumber: "BUG01-20261020",
    plannedCount: 1,
    desiredDate: "2026-11-20",
    shippingDate: "2026-11-21",
  });
  assert.equal(body.desired_date, "2026-11-20");
  assert.equal(body.shipping_date, "2026-11-21");
  assert.equal(body.quantity, 1);

  const workspace = readFileSync(
    join(root, "components/production/tech-cards-workspace.tsx"),
    "utf8",
  );
  assert.match(workspace, /shippingDate:\s*createDesiredDate\.trim\(\)/);
  assert.match(workspace, /desiredDate:\s*createDesiredDate\.trim\(\)/);
  const actions = readFileSync(
    join(root, "app/(workspace)/production/tech-cards/tech-card-actions.ts"),
    "utf8",
  );
  assert.ok(actions.includes("standaloneTechnicalCardCreateBody(input)"));
});

test("BUG-01 reload and saved plan show shipping_date, not ETA", () => {
  const beforePlan = presentPlanSummary(null, "2026-11-21");
  assert.equal(beforePlan.mode, "empty");
  assert.equal(beforePlan.shipping, "21.11.2026");
  assert.equal(beforePlan.ready, null);
  assert.equal(beforePlan.risk, null);

  const saved = presentPlanSummary(
    {
      planning_state: "planned",
      planned_completion_date: "2026-11-18",
      shipping_date: "2026-11-21",
      on_time: false,
      buffer_days: -3,
      delay_days: 0,
    },
    "2026-11-01",
  );
  assert.equal(saved.mode, "ready");
  assert.equal(saved.shipping, "21.11.2026");
  assert.equal(saved.ready, "18.11.2026");
  assert.equal(saved.risk, "Риск срока");
});
