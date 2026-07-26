import assert from "node:assert/strict";
import test from "node:test";

import { buildOrderDocumentTree } from "./order-documents-tree.ts";

test("builds lead → order → invoice → waybill tree with production and specification", () => {
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
  assert.equal(tree[0].children?.[0].children?.[0].label, "Счет на оплату");
  assert.equal(tree[0].children?.[0].children?.[0].children?.[0].label, "Товарная накладная");
  assert.equal(tree[0].children?.[1].label, "Заказ на производство");
  assert.equal(tree[0].children?.[1].children?.[0].label, "Тех карта 1");
  assert.equal(tree[0].children?.[1].children?.[1].label, "Тех карта 2");
  assert.equal(tree[0].children?.[2].label, "Спецификация");
});
