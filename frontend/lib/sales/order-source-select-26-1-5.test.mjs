import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.1.5 order source uses lead-create Select; keeps unknown filled values", () => {
  const order = readFileSync(
    join(root, "components/sales/order-client-need-details.tsx"),
    "utf8",
  );
  assert.ok(order.includes("leadCreateSourceOptions"));
  assert.ok(order.includes("leadCreateSourceOptions"));
  assert.ok(order.includes("sourceSelectOptions(draft.source)"));
  assert.ok(order.includes("known.has(current)"));

  const create = readFileSync(
    join(root, "components/sales/lead-create-dialog.tsx"),
    "utf8",
  );
  assert.ok(create.includes("leadCreateSourceOptions.map"));
});
