import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

async function readSource(relativeFromLib) {
  const path = fileURLToPath(new URL(relativeFromLib, import.meta.url));
  return readFile(path, "utf8");
}

test("settings nomenclature list redirects to warehouse stock", async () => {
  const source = await readSource(
    "../app/(workspace)/settings/catalogs/nomenclature/page.tsx",
  );
  assert.ok(source.includes('redirect("/warehouse/stock")'));
});

test("settings nomenclature categories redirects to warehouse stock", async () => {
  const source = await readSource(
    "../app/(workspace)/settings/catalogs/nomenclature-categories/page.tsx",
  );
  assert.ok(source.includes('redirect("/warehouse/stock")'));
});

test("warehouse nomenclature workspace keeps PT-04 create and balance contracts", async () => {
  const source = await readSource(
    "../components/warehouse/warehouse-nomenclature-workspace.tsx",
  );
  for (const marker of [
    "NomenclatureCreatePanels",
    "WarehouseCategoryTreePane",
    "filterByCategoryListScope",
    "filterByStockPresence",
    "stockBalanceOrZero",
    "Остаток",
    "С остатком",
    "12.2.3",
    "sl-design-v1",
    "Остатки номенклатуры",
  ]) {
    assert.ok(source.includes(marker), `missing warehouse marker: ${marker}`);
  }
});
