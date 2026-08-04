import assert from "node:assert/strict";
import test from "node:test";

import { fromApiClientListItem } from "./client-list-mapping.ts";

test("fromApiClientListItem maps company + aggregates", () => {
  const client = fromApiClientListItem({
    id: 7,
    company_name: "СК Олимп",
    contact_name: "Иван Петров",
    phone: "+79991112233",
    email: "ivan@olymp.test",
    city: "Казань",
    responsible_id: 1,
    responsible_name: "Мария Иванова",
    orders_count: 2,
    sales_amount: "20000.50",
    primary_sport: "Футбол",
    created_at: "2026-07-01T10:00:00+00:00",
    updated_at: "2026-08-01T12:00:00+00:00",
  });

  assert.equal(client.id, "7");
  assert.equal(client.name, "СК Олимп");
  assert.equal(client.type, "Клиент");
  assert.equal(client.ordersCount, 2);
  assert.equal(client.salesAmount, 20000.5);
  assert.equal(client.sport, "Футбол");
  assert.equal(client.status, "active");
  assert.equal(client.responsible.name, "Мария Иванова");
});

test("fromApiClientListItem uses contact name and new status without company/orders", () => {
  const client = fromApiClientListItem({
    id: 3,
    company_name: null,
    contact_name: "Анна",
    phone: null,
    email: null,
    city: null,
    responsible_id: null,
    responsible_name: null,
    orders_count: 0,
    sales_amount: 0,
    primary_sport: null,
    created_at: "2026-07-01T10:00:00+00:00",
    updated_at: "2026-07-02T10:00:00+00:00",
  });

  assert.equal(client.name, "Анна");
  assert.equal(client.phone, "—");
  assert.equal(client.city, "Не указан");
  assert.equal(client.sport, "Не указан");
  assert.equal(client.status, "new");
  assert.equal(client.responsible.name, "Не назначен");
});
