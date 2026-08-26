import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.2.2 order tech-cards are a 3-col mini grid with stage strips and icon Open", () => {
  const panel = readFileSync(
    join(root, "components/sales/sales-order-tech-cards-panel.tsx"),
    "utf8",
  );
  assert.ok(panel.includes("lg:grid-cols-3"));
  assert.ok(panel.includes("grid-cols-1"));
  assert.ok(panel.includes("data-order-tech-cards-grid"));
  assert.ok(panel.includes("data-stage-strip"));
  assert.ok(panel.includes("data-order-tech-card-mini"));
  assert.ok(panel.includes('aria-label="Открыть"'));
  assert.equal(panel.includes(">Открыть<"), false);
  assert.ok(panel.includes("{row.title}"));
});
