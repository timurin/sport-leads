import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

async function readRelative(path) {
  return readFile(fileURLToPath(new URL(path, import.meta.url)), "utf8");
}

test("sales boards Soft UI keeps live PT-03 fields and scoped chrome", async () => {
  const leads = await readRelative("../components/sales/lead-workspace.tsx");
  const ordersPage = await readRelative("../components/kanban/kanban-page.tsx");
  const ordersHost = await readRelative("../components/sales/orders-workspace.tsx");
  const shop = await readRelative("../components/production/shop-stage-kanban-workspace.tsx");
  const css = await readRelative("../app/globals.css");

  for (const marker of [
    "sl-design-v1",
    "sl-boards-v1",
    "Лиды",
    "активных",
    "Настроить стадии",
    "Создать лид",
    'variant="pills"',
    "Всего лидов",
    "Завершено",
    "Конвертировано",
    "Конверсия завершённых",
  ]) {
    assert.ok(leads.includes(marker), `leads board missing ${marker}`);
  }

  for (const marker of [
    "sl-design-v1",
    "sl-boards-v1",
    "заказов",
    "KanbanBoard",
  ]) {
    assert.ok(ordersPage.includes(marker), `orders board missing ${marker}`);
  }

  for (const marker of [
    "Всего заказов",
    "В производстве",
    "Сумма заказов",
    "Готовы к отгрузке",
    "Менеджер",
    "Тип продукции",
  ]) {
    assert.ok(ordersHost.includes(marker), `orders host missing ${marker}`);
  }

  assert.ok(!leads.includes("Сделки"));
  assert.ok(!ordersHost.includes("SO-2026-000142"));
  assert.ok(!shop.includes("sl-design-v1"));
  assert.ok(css.includes(".sl-design-v1 [data-pt03-column]"));
  assert.ok(css.includes(".sl-design-v1 [data-pt03-card]"));
});
