import assert from "node:assert/strict";
import test from "node:test";

import { toLeadConversionPayload } from "./lead-conversion.ts";

test("maps completion dialog values to the existing convert API payload", () => {
  assert.deepEqual(
    toLeadConversionPayload({
      title: "Заказ для клуба",
      description: "Комплекты",
      productCategory: "Игровая форма",
      sport: "Футбол",
      quantity: 24,
      amount: 125000.5,
      desiredDate: "2026-08-31",
    }),
    {
      title: "Заказ для клуба",
      description: "Комплекты",
      product_category: "Игровая форма",
      sport: "Футбол",
      quantity: 24,
      amount: 125000.5,
      desired_date: "2026-08-31",
    },
  );
});
