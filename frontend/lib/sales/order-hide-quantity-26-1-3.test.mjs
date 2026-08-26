import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.1.3 hides Количество on order client-need and lead commercial; payload still has quantity", () => {
  const order = readFileSync(
    join(root, "components/sales/order-client-need-details.tsx"),
    "utf8",
  );
  assert.ok(order.includes("quantity,"));
  assert.ok(order.includes("quantity: order.quantityValue"));
  assert.ok(!order.includes("value={draft.quantity}"));
  assert.ok(!order.includes(">Количество</dt>"));
  assert.match(order, /quantityRaw = draft\.quantity\.trim\(\)/);

  const lead = readFileSync(
    join(root, "components/sales/lead-commercial-details.tsx"),
    "utf8",
  );
  assert.ok(lead.includes("hideQuantity = true"));
  assert.ok(lead.includes('label="Количество изделий"'));
  assert.ok(lead.includes("{hideQuantity ? null : ("));
  assert.ok(lead.includes("productSummary(commercial, !hideQuantity"));
});
