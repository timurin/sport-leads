import assert from "node:assert/strict";
import test from "node:test";

import { fromApiSalesOrders } from "./order-list-api.ts";

test("maps persisted sales orders to existing kanban columns", () => {
  const columns = fromApiSalesOrders([{
    id: 41, number: "SO-41", lead_id: 9, client_id: 3, status: "new",
    responsible_id: 2, responsible_name: "Иван", client_name: "ООО Спорт",
    title: "Форма", description: null, product_category: "Форма", sport: "Футбол",
    quantity: 20, amount: "125000.00", desired_date: "2026-08-01", source: "website",
    created_at: "2026-07-18T10:00:00Z", updated_at: "2026-07-18T10:00:00Z",
  }]);

  assert.equal(columns.find((column) => column.id === "new")?.cards[0]?.subtitle, "ООО Спорт");
  assert.equal(columns.find((column) => column.id === "new")?.cards[0]?.href, "/sales/leads/9");
  assert.equal(columns.find((column) => column.id === "new")?.cards[0]?.amount, "125\u00a0000 ₽");
  assert.equal(columns.find((column) => column.id === "new")?.cards[0]?.responsible, "Иван");
});
