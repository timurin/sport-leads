import assert from "node:assert/strict";
import test from "node:test";

import {
  filterSewingOperationTemplates,
  mergeTemplateOperationIds,
  moveIdInList,
  validateSewingOperationTemplateName,
} from "./sewing-operation-templates.ts";

test("validateSewingOperationTemplateName", () => {
  assert.equal(validateSewingOperationTemplateName(""), "Укажите наименование шаблона");
  assert.equal(validateSewingOperationTemplateName("  Pack  "), null);
});

test("moveIdInList reorders", () => {
  assert.deepEqual(moveIdInList([1, 2, 3], 2, "up"), [2, 1, 3]);
  assert.deepEqual(moveIdInList([1, 2, 3], 2, "down"), [1, 3, 2]);
  assert.deepEqual(moveIdInList([1, 2, 3], 1, "up"), [1, 2, 3]);
});

test("filterSewingOperationTemplates", () => {
  const rows = [
    { id: 1, name: "Футболка базовая", lines: [], created_at: "", updated_at: "" },
    { id: 2, name: "Худи", lines: [], created_at: "", updated_at: "" },
  ];
  assert.equal(filterSewingOperationTemplates(rows, "фут").length, 1);
});

test("mergeTemplateOperationIds append and replace", () => {
  assert.deepEqual(
    mergeTemplateOperationIds([1], [2, 3, 1], { mode: "append" }),
    [1, 2, 3],
  );
  assert.deepEqual(
    mergeTemplateOperationIds([1, 9], [2, 3], {
      mode: "replace",
      excludedIds: [3],
    }),
    [2],
  );
});
