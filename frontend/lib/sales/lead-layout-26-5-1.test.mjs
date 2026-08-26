import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.5.1 lead layout A: communication is main column, no six MetricCards, no customerSummary", () => {
  const page = readFileSync(
    join(root, "components/sales/lead-page.tsx"),
    "utf8",
  );
  assert.ok(page.includes('label: "Коммуникации"'));
  assert.ok(page.includes('label: "Клиент"'));
  assert.ok(page.includes('label: "Интерес"'));
  assert.ok(page.includes("hideQuantity"));
  assert.ok(!page.includes("Ключевые метрики лида"));
  assert.ok(!page.includes("customerSummary="));
  assert.ok(page.includes("lead-communication-column"));
  assert.ok(!page.includes("PageActions"));

  const comms = readFileSync(
    join(root, "components/sales/lead-communication-panel.tsx"),
    "utf8",
  );
  assert.ok(comms.indexOf("lead-composer-actions") < comms.indexOf("data-lead-message-list"));
  assert.ok(!comms.includes("Основной контакт"));

  const css = readFileSync(join(root, "app/globals.css"), "utf8");
  assert.ok(css.includes("minmax(260px, 0.34fr) minmax(0, 1fr)"));
});
