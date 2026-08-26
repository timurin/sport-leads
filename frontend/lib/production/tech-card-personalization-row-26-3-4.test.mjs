import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.3.4 manager Персонализация is row 2 after Макет; shop title stays Поштучно", () => {
  const workspace = readFileSync(
    join(root, "components/production/tech-card-detail-workspace.tsx"),
    "utf8",
  );
  const mockup = workspace.indexOf('title="Макет"');
  const orderData = workspace.indexOf('title="Данные по заказу"');
  const model = workspace.indexOf('title="Модель и маршрут"');
  const row2 = workspace.indexOf("data-tech-card-doc-row2");
  const personalization = workspace.indexOf('title="Персонализация"');
  const row3 = workspace.indexOf("data-tech-card-doc-row3");
  const route = workspace.indexOf('title="Маршрут / участки"');

  assert.ok(mockup > 0 && mockup < orderData && orderData < model);
  assert.ok(model < row2 && row2 < personalization);
  assert.ok(personalization < row3 && row3 < route);
  assert.equal(workspace.includes('title="Поштучно"'), false);

  const shop = readFileSync(
    join(root, "components/production/tech-card-shop-floor-body.tsx"),
    "utf8",
  );
  assert.ok(shop.includes('title="Поштучно"'));
  assert.equal(shop.includes('title="Персонализация"'), false);
});
