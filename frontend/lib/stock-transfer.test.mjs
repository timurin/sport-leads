import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  isTransferDocument,
  stockDocumentTypeLabel,
  stockWarehouseColumnLabel,
} from "./stock-documents.ts";

async function readSource(relativeFromLib) {
  const path = fileURLToPath(new URL(relativeFromLib, import.meta.url));
  return readFile(path, "utf8");
}

test("transfer type label and warehouse column (12.5.1.5)", () => {
  assert.equal(stockDocumentTypeLabel("transfer"), "Перемещение");
  assert.equal(isTransferDocument({ doc_type: "transfer" }), true);
  assert.equal(isTransferDocument({ doc_type: "inventory" }), false);
  assert.equal(
    stockWarehouseColumnLabel(
      {
        doc_type: "transfer",
        warehouse_id: 1,
        destination_warehouse_id: 2,
      },
      { 1: "Основной", 2: "Цех" },
    ),
    "Основной → Цех",
  );
  assert.equal(
    stockWarehouseColumnLabel(
      { doc_type: "receipt", warehouse_id: 1 },
      { 1: "Основной" },
    ),
    "Основной",
  );
});

test("transfer API and movements UI wiring (12.5.1.5)", async () => {
  const client = await readSource("./stock-documents.ts");
  assert.ok(client.includes("/stock/transfers"));
  assert.ok(client.includes("createTransferDocument"));
  assert.ok(client.includes("postTransferDocument"));
  assert.ok(client.includes("setTransferLine"));
  assert.ok(client.includes("removeTransferLine"));

  const actions = await readSource(
    "../app/(workspace)/warehouse/movements/transfer-actions.ts",
  );
  assert.ok(actions.includes("createTransferDocumentAction"));
  assert.ok(actions.includes("postTransferDocumentAction"));

  const list = await readSource(
    "../components/warehouse/warehouse-movements-workspace.tsx",
  );
  assert.ok(list.includes('value: "transfer"'));
  assert.ok(list.includes("Перемещение"));
  assert.ok(list.includes("TransferCreateDrawer"));
  assert.match(list, /<DataTableHead>\s*<DataTableRow>/);

  const drawer = await readSource(
    "../components/warehouse/transfer-create-drawer.tsx",
  );
  assert.ok(drawer.includes("data-stock-transfer-create"));
  assert.ok(drawer.includes("Со склада"));
  assert.ok(drawer.includes("На склад"));

  const card = await readSource(
    "../components/warehouse/warehouse-movement-document-card.tsx",
  );
  assert.ok(card.includes("Строки перемещения"));
  assert.ok(card.includes("postTransferDocumentAction"));
  assert.match(card, /<DataTableHead>\s*<DataTableRow>/);
});
