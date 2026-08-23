import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

async function readSource(relativeFromLib) {
  const path = fileURLToPath(new URL(relativeFromLib, import.meta.url));
  return readFile(path, "utf8");
}

test("dashboard home Soft UI has live shortcuts and no demo KPIs", async () => {
  const source = await readSource(
    "../components/dashboard/home-workspace.tsx",
  );
  for (const marker of [
    "sl-design-v1",
    "/sales/leads",
    "/sales/dashboard",
    "/production/orders",
    "/warehouse/stock",
    "/purchases",
    "Обзор платформы",
  ]) {
    assert.ok(source.includes(marker), `missing dashboard marker: ${marker}`);
  }
  assert.ok(!source.includes("+6 за неделю"));
  assert.ok(!source.includes("4,2 млн"));
  assert.ok(!source.includes("SO-2026-000142"));
});
