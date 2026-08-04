import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("1.3.3 deals page redirects to orders", () => {
  const deals = readFileSync(join(root, "app/(workspace)/sales/deals/page.tsx"), "utf8");
  assert.match(deals, /redirect\("\/sales\/orders"\)/);
  assert.equal(deals.includes("KanbanPage"), false);
  assert.equal(deals.includes("dealColumns"), false);
});
