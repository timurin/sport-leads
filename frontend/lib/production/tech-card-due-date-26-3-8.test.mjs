import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  clampIsoToMonth,
  daysInMonth,
  mondayIndex,
  monthGrid,
  parseIsoDate,
  toIsoDate,
  WEEKDAY_LABELS_RU,
  yearOptions,
} from "./tech-card-due-date.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.3.8 month grid starts on Monday and pads to weeks", () => {
  assert.equal(daysInMonth(2026, 9), 30);
  assert.equal(mondayIndex(2026, 9, 1), 1);
  assert.deepEqual(parseIsoDate("2026-09-15"), { year: 2026, month: 9, day: 15 });
  assert.equal(toIsoDate(2026, 9, 5), "2026-09-05");
  assert.equal(clampIsoToMonth("2026-01-31", 2026, 2), "2026-02-28");

  const cells = monthGrid(2026, 9);
  assert.equal(cells.length % 7, 0);
  assert.equal(cells[0].day, null);
  assert.equal(cells[1].iso, "2026-09-01");
  assert.equal(WEEKDAY_LABELS_RU.length, 7);
  assert.deepEqual(yearOptions(2026, 2026).slice(0, 3), [2024, 2025, 2026]);
});

test("26.3.8 order-data edit uses due-date calendar with month and year", () => {
  const card = readFileSync(
    join(root, "components/production/tech-card-order-data-card.tsx"),
    "utf8",
  );
  assert.ok(card.includes("data-tech-card-due-date-calendar"));
  assert.ok(card.includes("data-tech-card-due-date-month"));
  assert.ok(card.includes("data-tech-card-due-date-year"));
  assert.ok(card.includes("updateTechnicalCardDesiredDateAction"));
  assert.ok(card.includes("MONTH_LABELS_RU"));
  assert.ok(card.includes("WEEKDAY_LABELS_RU"));

  const actions = readFileSync(
    join(root, "app/(workspace)/production/tech-cards/tech-card-actions.ts"),
    "utf8",
  );
  assert.ok(actions.includes("/technical-cards/${cardId}/desired-date"));
  assert.ok(actions.includes("sessionAuthHeaders"));

  const shop = readFileSync(
    join(root, "components/production/tech-card-shop-floor-body.tsx"),
    "utf8",
  );
  assert.equal(shop.includes("data-tech-card-due-date-calendar"), false);
});
