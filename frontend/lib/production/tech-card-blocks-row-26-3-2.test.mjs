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

test("26.3.2 manager ops / assembly / materials share one xl 3-col row", () => {
  const personalization = workspace.indexOf('title="Персонализация"');
  const rowStart = workspace.indexOf("data-tech-card-doc-row3");
  const ops = workspace.indexOf('title="Операции / объёмы"');
  const scheme = workspace.indexOf('title="Схема сборки изделия"');
  const materials = workspace.indexOf('title="Состав материалов"');
  const route = workspace.indexOf('title="Маршрут / участки"');

  assert.ok(rowStart > 0);
  assert.ok(workspace.includes("xl:grid-cols-3"));
  assert.ok(personalization > 0 && personalization < rowStart);
  assert.ok(rowStart < ops && ops < scheme && scheme < materials);
  assert.ok(materials < workspace.indexOf("</div>", materials));
  assert.ok(materials < route);

  const rowChunk = workspace.slice(rowStart, route);
  assert.ok(rowChunk.includes('title="Операции / объёмы"'));
  assert.ok(rowChunk.includes('title="Схема сборки изделия"'));
  assert.ok(rowChunk.includes('title="Состав материалов"'));
  assert.equal(rowChunk.includes('title="Маршрут / участки"'), false);
  assert.equal(rowChunk.includes('title="Персонализация"'), false);
});
