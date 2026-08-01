import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("nomenclature archive/restore UX polish (4.3.3.3)", () => {
  const warehouse = readFileSync(
    join(root, "components/warehouse/warehouse-nomenclature-workspace.tsx"),
    "utf8",
  );
  assert.ok(warehouse.includes('value="inactive">Архив</option>'));
  assert.ok(warehouse.includes('value="all">Все статусы</option>'));

  const card = readFileSync(
    join(root, "components/settings/nomenclature-card.tsx"),
    "utf8",
  );
  assert.ok(card.includes("Восстановить"));
  assert.ok(card.includes("из архива"));
  // Status select appears in both edit and view modes (restore without edit).
  const statusSelectMatches = card.match(/aria-label="Состояние"/g);
  assert.equal(statusSelectMatches?.length, 2);
});
