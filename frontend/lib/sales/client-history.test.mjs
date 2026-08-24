import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  filterClientHistoryItems,
  fromApiClientHistoryItem,
} from "./client-history.ts";

test("maps lead and order history rows without demo hrefs", () => {
  const lead = fromApiClientHistoryItem({
    kind: "lead",
    id: 41,
    occurred_at: "2026-08-01T10:00:00+00:00",
    title: "Форма",
    status: "new",
    amount: null,
    sport: "Футбол",
    source: "website",
  });
  assert.equal(lead.href, "/sales/leads/41");
  assert.equal(lead.statusLabel, "Новый");
  assert.equal(lead.amountLabel, null);

  const order = fromApiClientHistoryItem({
    kind: "order",
    id: 15,
    occurred_at: "2026-08-02T10:00:00+00:00",
    title: "SO-15 · Форма",
    status: "confirmed",
    amount: "12000",
    sport: "Футбол",
    source: null,
  });
  assert.equal(order.href, "/sales/orders/15");
  assert.equal(order.statusLabel, "Подтверждён");
  assert.match(order.amountLabel ?? "", /12/);
});

test("filters history kinds locally", () => {
  const items = [
    fromApiClientHistoryItem({
      kind: "lead",
      id: 1,
      occurred_at: "2026-08-01T10:00:00+00:00",
      title: "Лид",
      status: "new",
      amount: null,
      sport: null,
      source: null,
    }),
    fromApiClientHistoryItem({
      kind: "order",
      id: 2,
      occurred_at: "2026-08-02T10:00:00+00:00",
      title: "Заказ",
      status: "new",
      amount: "1",
      sport: null,
      source: null,
    }),
  ];
  assert.equal(filterClientHistoryItems(items, "all").length, 2);
  assert.deepEqual(
    filterClientHistoryItems(items, "lead").map((item) => item.kind),
    ["lead"],
  );
});

test("client card hosts history panel not demo orders", async () => {
  const card = await readFile(
    fileURLToPath(new URL("../../components/sales/client-card.tsx", import.meta.url)),
    "utf8",
  );
  assert.ok(card.includes("ClientHistoryPanel"));
  assert.ok(!card.includes("Demo-данные"));
});
