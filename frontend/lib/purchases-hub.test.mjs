import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

async function readSource(relativeFromLib) {
  const path = fileURLToPath(new URL(relativeFromLib, import.meta.url));
  return readFile(path, "utf8");
}

test("purchases hub is Soft UI chrome without demo PO rows", async () => {
  const source = await readSource(
    "../components/purchases/purchases-hub-workspace.tsx",
  );
  for (const marker of [
    "sl-design-v1",
    "Stage 13",
    "/warehouse/stock",
    "/warehouse/movements",
    "13.1.2",
    "13.1.1",
  ]) {
    assert.ok(source.includes(marker), `missing purchases marker: ${marker}`);
  }
  assert.ok(!source.includes("PO-S-2026"));
  assert.ok(!source.includes("Текстиль-Опт"));
});
