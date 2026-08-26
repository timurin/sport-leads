import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { fieldsForBlock } from "./lead-card-fields.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("fieldsForBlock keeps sort order for one section", () => {
  const rows = fieldsForBlock(
    [
      { id: 2, block: "interest", label: "B", sortOrder: 1, value: "" },
      { id: 1, block: "customer", label: "A", sortOrder: 0, value: "x" },
      { id: 3, block: "interest", label: "C", sortOrder: 0, value: "y" },
    ],
    "interest",
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    [3, 2],
  );
});

test("add-field draft uses header save and cancel icons", () => {
  const source = readFileSync(join(root, "components/sales/lead-card-custom-fields.tsx"), "utf8");
  assert.ok(source.includes('label="Отмена"'));
  assert.ok(source.includes('label="Сохранить"'));
  assert.ok(source.includes("<X size={16}"));
  assert.ok(source.includes("<Check size={16}"));
  assert.ok(!source.includes(">\n              Добавить\n            </button>"));
});
