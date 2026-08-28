import assert from "node:assert/strict";
import test from "node:test";

import {
  formatSpecificationQty,
  specificationMatchesQuery,
  specificationOperationSourceLabel,
  specificationStatusLabel,
  specificationsByBatchId,
} from "./specifications.ts";

test("specification status and source labels", () => {
  assert.equal(specificationStatusLabel("draft"), "Черновик");
  assert.equal(specificationStatusLabel("approved"), "Утверждена");
  assert.equal(specificationOperationSourceLabel("sewing"), "Пошив");
  assert.equal(formatSpecificationQty("2.5"), "2.5");
  assert.equal(formatSpecificationQty(null), "—");
});

test("specification list query matches number and related documents", () => {
  const item = {
    number: "PO-SO-1-1-B1-SPEC",
    production_batch_number: "PO-SO-1-1-B1",
    sales_order_number: "SO-1",
    production_order_number: "PO-SO-1-1",
  };
  assert.equal(specificationMatchesQuery(item, "spec"), true);
  assert.equal(specificationMatchesQuery(item, "SO-1"), true);
  assert.equal(specificationMatchesQuery(item, "неттакого"), false);
});

test("standalone specification query matches group number (28.5.3)", () => {
  const item = {
    number: "PO-1310-1-B1-SPEC",
    production_batch_number: "PO-1310-1-B1",
    sales_order_number: "1310",
    production_order_number: "PO-1310-1",
  };
  assert.equal(specificationMatchesQuery(item, "1310"), true);
});

test("standalone specification UI hides sales-order deep-link (28.5.3)", async () => {
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const read = (rel) =>
    readFile(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

  const types = await read("./specifications.ts");
  assert.ok(types.includes("sales_order_id: number | null"));

  const list = await read(
    "../../components/production/specifications-workspace.tsx",
  );
  assert.ok(list.includes("data-standalone-specification-order"));
  assert.ok(list.includes("item.sales_order_id != null"));

  const card = await read(
    "../../components/production/specification-card.tsx",
  );
  assert.ok(card.includes("data-standalone-specification-order"));
  assert.ok(card.includes("specification.sales_order_id != null"));
});

test("list DTO stays slim: batch map does not invent nested lines", () => {
  const mapped = specificationsByBatchId([
    {
      id: 4,
      number: "PO-1-B1-SPEC",
      production_batch_id: 9,
      production_batch_number: "PO-1-B1",
      sales_order_id: 2,
      sales_order_number: "SO-1",
      production_order_id: 3,
      production_order_number: "PO-1",
      current_version_no: 1,
      current_version_status: "draft",
      created_at: "2026-08-25T10:00:00+00:00",
      updated_at: "2026-08-25T10:00:00+00:00",
    },
  ]);
  assert.equal(mapped[9]?.id, 4);
  assert.equal("product_lines" in mapped[9], false);
  assert.equal("current_version" in mapped[9], false);
});
