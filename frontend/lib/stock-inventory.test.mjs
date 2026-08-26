import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  inventoryLineDelta,
  isInventoryDocument,
  stockDocumentTypeLabel,
} from "./stock-documents.ts";

async function readSource(relativeFromLib) {
  const path = fileURLToPath(new URL(relativeFromLib, import.meta.url));
  return readFile(path, "utf8");
}

test("inventory type label and delta (12.4.1.5)", () => {
  assert.equal(stockDocumentTypeLabel("inventory"), "Инвентаризация");
  assert.equal(isInventoryDocument({ doc_type: "inventory" }), true);
  assert.equal(isInventoryDocument({ doc_type: "receipt" }), false);
  assert.equal(inventoryLineDelta("10.000", "12.000"), "2");
  assert.equal(inventoryLineDelta("10.000", "8.500"), "-1,5");
  assert.equal(inventoryLineDelta("4.000", "4.000"), "0");
});

test("inventory API and movements UI wiring (12.4.1.5)", async () => {
  const client = await readSource("./stock-documents.ts");
  assert.ok(client.includes("/stock/inventory"));
  assert.ok(client.includes("createInventoryDocument"));
  assert.ok(client.includes("postInventoryDocument"));
  assert.ok(client.includes("refreshInventoryBook"));
  assert.ok(client.includes("setInventoryCounted"));

  const actions = await readSource(
    "../app/(workspace)/warehouse/movements/inventory-actions.ts",
  );
  assert.ok(actions.includes("createInventoryDocumentAction"));
  assert.ok(actions.includes("postInventoryDocumentAction"));

  const list = await readSource(
    "../components/warehouse/warehouse-movements-workspace.tsx",
  );
  assert.ok(list.includes('value: "inventory"'));
  assert.ok(list.includes("Инвентаризация"));
  assert.ok(list.includes("InventoryCreateDrawer"));
  assert.match(list, /<DataTableHead>\s*<DataTableRow>/);

  const card = await readSource(
    "../components/warehouse/warehouse-movement-document-card.tsx",
  );
  assert.ok(card.includes("book_qty"));
  assert.ok(card.includes("counted_qty"));
  assert.ok(card.includes("Пересчёт"));
  assert.match(card, /<DataTableHead>\s*<DataTableRow>/);

  const inventoryHost = await readSource(
    "../app/(workspace)/warehouse/inventory/page.tsx",
  );
  assert.ok(inventoryHost.includes('redirect("/warehouse/movements")'));
});
