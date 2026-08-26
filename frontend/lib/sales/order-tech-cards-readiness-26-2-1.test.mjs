import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.2.1 readiness bar sits under the tech-cards title; summary block is gone", () => {
  const panel = readFileSync(
    join(root, "components/sales/sales-order-tech-cards-panel.tsx"),
    "utf8",
  );
  assert.equal(panel.includes("Готовность производства"), false);
  assert.equal(panel.includes("Eligible:"), false);
  assert.ok(panel.includes("afterTitle={summary ? <ReadinessBar"));
  assert.ok(panel.includes("data-order-tech-cards-readiness"));
  assert.ok(panel.includes("bg-gradient-to-r from-portal-primary"));
});
