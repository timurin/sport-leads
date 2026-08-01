import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("nomenclature card wires history from API (4.3.3.2)", () => {
  const lib = readFileSync(join(root, "lib/nomenclature.ts"), "utf8");
  assert.ok(lib.includes("export type NomenclatureHistoryEntry"));
  assert.ok(lib.includes("getNomenclatureHistory"));
  assert.ok(lib.includes("/nomenclatures/${id}/history"));

  const page = readFileSync(
    join(
      root,
      "app/(workspace)/settings/catalogs/nomenclature/[nomenclatureId]/page.tsx",
    ),
    "utf8",
  );
  assert.ok(page.includes("getNomenclatureHistory"));
  assert.ok(page.includes("history={history}"));

  const card = readFileSync(
    join(root, "components/settings/nomenclature-card.tsx"),
    "utf8",
  );
  assert.ok(card.includes("history?: NomenclatureHistoryEntry[]"));
  assert.ok(card.includes("entry.action"));
  assert.ok(card.includes("entry.actor"));
  assert.ok(!card.includes('label: "Карточка создана"'));
  assert.ok(!card.includes('label: "Последнее изменение"'));
});
