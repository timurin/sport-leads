import assert from "node:assert/strict";
import test from "node:test";

import { buildOrderDocumentTree } from "./order-documents-tree.ts";

test("builds lead → order tree with empty commercial placeholders", () => {
  const tree = buildOrderDocumentTree({
    id: "4",
    number: "SO-2026-000004",
    leadId: "9",
    sourceLeadHref: "/sales/leads/9",
  });

  assert.equal(tree.length, 1);
  assert.equal(tree[0].label, "Лид #9");
  assert.equal(tree[0].children?.length, 3);
  assert.equal(tree[0].children?.[0].label, "Заказ SO-2026-000004");
  const orderChildren = tree[0].children?.[0].children ?? [];
  assert.equal(orderChildren[0].label, "КП (пока нет)");
  assert.equal(orderChildren[0].status, "planned");
  assert.equal(orderChildren[1].label, "Счёт на оплату (пока нет)");
  assert.equal(orderChildren[2].label, "Товарная накладная");
  assert.equal(tree[0].children?.[1].label, "Заказ на производство");
  assert.equal(tree[0].children?.[2].label, "Спецификация");
});

test("renders live quotation and invoice nodes from API summaries", () => {
  const tree = buildOrderDocumentTree({
    id: "4",
    number: "SO-2026-000004",
    leadId: "9",
    sourceLeadHref: "/sales/leads/9",
    quotations: [{ id: 1, number: "КП-4-001", status: "draft" }],
    invoices: [{ id: 2, number: "СЧ-4-001", status: "draft", quotationId: 1 }],
  });
  const orderChildren = tree[0].children?.[0].children ?? [];
  assert.equal(orderChildren[0].label, "КП КП-4-001");
  assert.equal(orderChildren[0].status, "live");
  assert.equal(orderChildren[1].label, "Счёт СЧ-4-001");
  assert.equal(orderChildren[1].children?.[0].label, "из КП #1");
});
