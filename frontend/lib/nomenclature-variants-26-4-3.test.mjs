import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("26.4.3 nomenclature card has no Варианты block", () => {
  const card = readFileSync(
    join(root, "components/settings/nomenclature-card.tsx"),
    "utf8",
  );
  assert.ok(!card.includes("NomenclatureVariantsBlock"));
  assert.ok(!card.includes("Варианты"));

  const page = readFileSync(
    join(
      root,
      "app/(workspace)/settings/catalogs/nomenclature/[nomenclatureId]/page.tsx",
    ),
    "utf8",
  );
  assert.ok(!page.includes("getNomenclatureVariants"));
  assert.ok(!page.includes("variants="));
});
