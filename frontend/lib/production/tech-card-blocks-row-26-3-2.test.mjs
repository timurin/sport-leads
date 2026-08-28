import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const workspace = readFileSync(
  join(root, "components/production/tech-card-detail-workspace.tsx"),
  "utf8",
);

test("26.3.2 manager doc blocks use tabs (ops / scheme / assembly / materials / route)", () => {
  assert.ok(workspace.includes("data-tech-card-doc-tabs"));
  assert.ok(workspace.includes('label: "Персонализация"'));
  assert.ok(workspace.includes('label: "Материалы"'));
  assert.ok(workspace.includes('label: "Операции"'));
  assert.ok(workspace.includes('label: "Пошив"'));
  assert.ok(workspace.includes('label: "Маршрут"'));
  assert.equal(workspace.includes('label: "Схема"'), false);
  assert.equal(workspace.includes('label: "Сборки"'), false);
  assert.ok(workspace.includes('title="Операции / объёмы"'));
  assert.ok(workspace.includes('title="Схема сборки изделия"'));
  assert.ok(workspace.includes('title="Состав материалов"'));
  assert.ok(workspace.includes('title="Маршрут / участки"'));
  assert.ok(workspace.includes("<CompactTabs"));
});
