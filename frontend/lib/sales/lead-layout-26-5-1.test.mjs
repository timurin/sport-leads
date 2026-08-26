import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.5.1 lead layout A: facts left without duplicate fields, composer first", () => {
  const page = readFileSync(
    join(root, "components/sales/lead-page.tsx"),
    "utf8",
  );
  assert.ok(page.includes('label: "Коммуникации"'));
  assert.ok(page.includes('label: "Клиент"'));
  assert.ok(page.includes('label: "Интерес"'));
  assert.ok(page.includes("hideQuantity"));
  assert.ok(page.includes("nextContactLabel"));
  assert.ok(!page.includes("Ключевые метрики лида"));
  assert.ok(!page.includes("Ключевые показатели"));
  assert.ok(!page.includes("customerSummary="));
  assert.ok(page.includes("lead-communication-column"));
  assert.ok(page.includes('id="lead-reference-panel-customer"'));
  assert.ok(!page.includes("PageActions"));

  const comms = readFileSync(
    join(root, "components/sales/lead-communication-panel.tsx"),
    "utf8",
  );
  assert.ok(comms.indexOf("lead-composer-actions") < comms.indexOf("data-lead-message-list"));
  assert.ok(comms.includes(">Задача<"));
  assert.ok(comms.includes("lead-feed-card"));
  assert.ok(!comms.includes("Основной контакт"));
  assert.ok(!comms.includes("customerSummary"));
  assert.ok(!comms.includes("Каналы коммуникации"));

  const css = readFileSync(join(root, "app/globals.css"), "utf8");
  assert.ok(css.includes("minmax(240px, 22rem) minmax(0, 1fr)"));
  assert.match(css, /\.lead-composer-actions\s*\{\s*display:\s*flex;/);
  assert.match(css, /\.lead-fact-kv\s*\{/);
  assert.match(css, /\.lead-fact-kv \.lead-detail-pair > dt\s*\{[^}]*font-weight:\s*400/);
  assert.match(css, /\.lead-fact-kv \.lead-detail-pair > dd\s*\{[^}]*font-weight:\s*400/);
  assert.ok(css.includes(".lead-compact-details form .grid"));
  assert.match(css, /\.lead-compact-details \.lead-detail-pair > dd \{\s*\n\s*font-size:\s*15px;/);
  assert.match(css, /\.lead-compact-details form :is\(input, select, textarea\)\s*\{[^}]*font-size:\s*15px !important/);
  assert.match(css, /\.lead-compact-details form select option,\s*\n\.lead-compact-details \[role="listbox"\] \[role="option"\] \{\s*\n[^}]*font-size:\s*15px !important/);
  assert.match(css, /line-height:\s*2\.5 !important/);
  assert.match(css, /\.lead-compact-details form label,\s*\n\.lead-compact-details form label > span:first-child \{\s*\n[^}]*font-size:\s*12px !important/);

  const customer = readFileSync(
    join(root, "components/sales/lead-customer-details.tsx"),
    "utf8",
  );
  assert.ok(customer.includes('label="Контакт"'));
  assert.ok(customer.includes("lead-fact-kv"));
  assert.ok(customer.includes('label="Редактировать"'));
  assert.ok(customer.includes('label="Сохранить"'));
  assert.ok(customer.includes('label="Отмена"'));
  assert.ok(!customer.includes("A) Основная информация"));

  const commercial = readFileSync(
    join(root, "components/sales/lead-commercial-details.tsx"),
    "utf8",
  );
  assert.ok(commercial.includes("estimatedAmount: nextAmount.value ?? null"));
  assert.ok(commercial.includes('label="Заметки о клиенте"'));
  assert.ok(commercial.includes('compactChrome("Доставка"'));
  assert.ok(commercial.includes('compactChrome("Метрики"'));
  assert.ok(commercial.includes("productSummary(commercial, !hideQuantity, true)"));
  assert.ok(commercial.includes('label="Редактировать"'));
  assert.ok(!commercial.includes("B) Потребность клиента"));
});
