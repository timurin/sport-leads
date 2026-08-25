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
