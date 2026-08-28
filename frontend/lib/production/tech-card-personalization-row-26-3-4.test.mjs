import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.3.4 manager Персонализация lives in Сборки tab; shop title stays Поштучно", () => {
  const workspace = readFileSync(
    join(root, "components/production/tech-card-detail-workspace.tsx"),
    "utf8",
  );
  const mockup = workspace.indexOf('title="Макет"');
  const orderData = workspace.indexOf("<TechCardOrderDataCard");
  const model = workspace.indexOf("<TechCardModelRouteCard");
  const tabs = workspace.indexOf("data-tech-card-doc-tabs");
  const assemblyTab = workspace.indexOf('data-tech-card-doc-tab="assembly"');
  const personalization = workspace.indexOf('title="Персонализация"');
  const route = workspace.indexOf('title="Маршрут / участки"');

  assert.ok(mockup > 0 && mockup < orderData && orderData < model);
  assert.ok(model < tabs && tabs < assemblyTab);
  assert.ok(assemblyTab < personalization && personalization < route);
  assert.equal(workspace.includes('title="Поштучно"'), false);

  const shop = readFileSync(
    join(root, "components/production/tech-card-shop-floor-body.tsx"),
    "utf8",
  );
  assert.ok(shop.includes('title="Поштучно"'));
  assert.equal(shop.includes('title="Персонализация"'), false);
});
