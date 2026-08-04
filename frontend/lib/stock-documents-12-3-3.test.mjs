import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  filterStockDocumentsClient,
  formatStockQuantity,
  stockDocumentStatusLabel,
  stockDocumentTypeLabel,
} from "./stock-documents.ts";

async function readSource(relativeFromLib) {
  const path = fileURLToPath(new URL(relativeFromLib, import.meta.url));
  return readFile(path, "utf8");
}

test("stock document labels and qty format (12.3.3)", () => {
  assert.equal(stockDocumentTypeLabel("fg_receipt"), "Приход ГП");
  assert.equal(stockDocumentTypeLabel("fg_issue"), "Списание ГП");
  assert.equal(stockDocumentStatusLabel("posted"), "Проведён");
  assert.equal(formatStockQuantity("3.000"), "3");
  assert.equal(formatStockQuantity("-2.5"), "-2,5");
});

test("filterStockDocumentsClient matches number and type labels", () => {
  const rows = [
    {
      id: 1,
      number: "STK-000001",
      doc_type: "fg_receipt",
      status: "posted",
      warehouse_id: 1,
      posted_at: null,
      technical_card_id: 9,
      sales_order_id: 3,
      notes: null,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
      ledger_lines: [],
    },
  ];
  assert.equal(filterStockDocumentsClient(rows, "STK-000001").length, 1);
  assert.equal(filterStockDocumentsClient(rows, "приход гп").length, 1);
  assert.equal(filterStockDocumentsClient(rows, "missing").length, 0);
});

test("warehouse movements routes and client wired (12.3.3)", async () => {
  const client = await readSource("./stock-documents.ts");
  assert.ok(client.includes("/stock/documents"));
  assert.ok(client.includes("listStockDocuments"));
  assert.ok(client.includes("getStockDocument"));

  const listPage = await readSource(
    "../app/(workspace)/warehouse/movements/page.tsx",
  );
  assert.ok(listPage.includes("WarehouseMovementsWorkspace"));
  assert.ok(listPage.includes("listStockDocuments"));

  const cardPage = await readSource(
    "../app/(workspace)/warehouse/movements/[documentId]/page.tsx",
  );
  assert.ok(cardPage.includes("WarehouseMovementDocumentCard"));
  assert.ok(cardPage.includes("getStockDocument"));

  const nav = await readSource("./navigation.ts");
  assert.ok(nav.includes('href: "/warehouse/movements"'));
});
