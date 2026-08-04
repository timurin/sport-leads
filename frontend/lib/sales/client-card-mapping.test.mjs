import assert from "node:assert/strict";
import test from "node:test";

import { fromApiClientDetail } from "./client-card-mapping.ts";

test("fromApiClientDetail maps recent orders", () => {
  const card = fromApiClientDetail({
    id: 7,
    company_name: "СК Олимп",
    contact_name: "Иван Петров",
    phone: "+79991112233",
    email: "ivan@olymp.test",
    city: "Казань",
    responsible_id: 1,
    responsible_name: "Мария Иванова",
    orders_count: 1,
    sales_amount: "12000.50",
    primary_sport: "Футбол",
    created_at: "2026-07-01T10:00:00+00:00",
    updated_at: "2026-08-01T12:00:00+00:00",
    recent_orders: [
      {
        id: 15,
        number: "SO-15",
        title: "Форма",
        status: "confirmed",
        amount: "12000.50",
        sport: "Футбол",
        created_at: "2026-07-20T10:00:00+00:00",
      },
    ],
  });

  assert.equal(card.name, "СК Олимп");
  assert.equal(card.recentOrders.length, 1);
  assert.equal(card.recentOrders[0].number, "SO-15");
  assert.equal(card.recentOrders[0].href, "/sales/orders/15");
  assert.equal(card.recentOrders[0].statusLabel, "Подтверждён");
});
