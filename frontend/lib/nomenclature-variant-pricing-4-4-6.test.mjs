import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("variant pricing helpers and UI wiring (4.4.6)", () => {
  const lib = readFileSync(join(root, "lib/nomenclature.ts"), "utf8");
  assert.ok(lib.includes("effectiveVariantUnitPrice"));
  assert.ok(lib.includes("barcode: string | null"));
  assert.ok(lib.includes("external_code: string | null"));

  const orderItems = readFileSync(
    join(root, "components/sales/sales-order-items.tsx"),
    "utf8",
  );
  assert.ok(orderItems.includes("effectiveVariantUnitPrice"));
  assert.ok(orderItems.includes("selectVariant"));
  assert.ok(orderItems.includes("selectCreateVariant"));

  const actions = readFileSync(
    join(
      root,
      "app/(workspace)/settings/catalogs/nomenclature/characteristics-actions.ts",
    ),
    "utf8",
  );
  assert.ok(actions.includes("updateNomenclatureVariantCommercial"));
});
