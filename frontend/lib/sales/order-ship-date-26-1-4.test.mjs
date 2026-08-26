import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.1.4 order+lead: Дата отгрузки is desired_date; planned_order_date is Дата входа в производство", () => {
  const order = readFileSync(
    join(root, "components/sales/order-client-need-details.tsx"),
    "utf8",
  );
  assert.equal(order.includes("Желаемая дата"), false);
  assert.ok(order.includes("Дата отгрузки"));
  assert.ok(order.includes("desiredDate: draft.desiredDate.trim() || null"));

  const lead = readFileSync(
    join(root, "components/sales/lead-commercial-details.tsx"),
    "utf8",
  );
  assert.equal(lead.includes("Планируемая дата заказа"), false);
  assert.equal(lead.includes('label="Дата заказа"'), false);
  assert.ok(lead.includes('label="Дата входа в производство"'));
  assert.ok(lead.includes('label="Дата отгрузки"'));
  assert.ok(lead.includes("desiredReadyDate: optionalText(draft.desiredReadyDate)"));
  assert.ok(lead.includes("desiredReadyDate: change.commercial.desiredReadyDate"));
});
