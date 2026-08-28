import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("assembly variants block wires inline qty/price/time PATCH (26.10.6)", () => {
  const block = readFileSync(
    join(root, "components/settings/assembly-variants-block.tsx"),
    "utf8",
  );
  assert.ok(block.includes("updateAssemblyOperationLine"));
  assert.ok(block.includes("assemblyOperationLineFieldPatch"));
  assert.ok(block.includes(">Время<"));
  assert.ok(block.includes("ariaLabel=\"Кол-во\""));
  assert.ok(block.includes("ariaLabel=\"Цена\""));
  assert.ok(block.includes("ariaLabel=\"Время, секунды\""));
  assert.ok(!block.includes("duration_seconds) || 0) *"));

  const actions = readFileSync(
    join(
      root,
      "app/(workspace)/settings/catalogs/product-models/product-model-actions.ts",
    ),
    "utf8",
  );
  assert.ok(actions.includes("updateAssemblyOperationLine"));
  assert.ok(actions.includes("method: \"PATCH\""));
  assert.ok(actions.includes("/operation-lines/${lineId}"));
});
