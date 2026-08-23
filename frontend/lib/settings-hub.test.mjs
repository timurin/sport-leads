import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

async function readSource(relativeFromLib) {
  const path = fileURLToPath(new URL(relativeFromLib, import.meta.url));
  return readFile(path, "utf8");
}

test("settings hub Soft UI keeps live catalog and users links", async () => {
  const source = await readSource("../app/(workspace)/settings/page.tsx");
  for (const marker of [
    "sl-design-v1",
    "/settings/users",
    "/settings/integrations",
    "Почтовый ящик",
    "/settings/catalogs/warehouses",
    "/settings/organizations",
    "Настройки платформы",
  ]) {
    assert.ok(source.includes(marker), `missing settings marker: ${marker}`);
  }
  assert.ok(!source.includes("Sport-Lead Demo"));
});
