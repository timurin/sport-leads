import assert from "node:assert/strict";
import test from "node:test";

import {
  formatTechCardDisplayNumber,
  techCardVisibleNumber,
} from "./tech-card-display.ts";

test("formatTechCardDisplayNumber appends planned count", () => {
  assert.equal(formatTechCardDisplayNumber("1310-1", 5), "1310-1/5");
  assert.equal(formatTechCardDisplayNumber("1310-1", null), "1310-1");
  assert.equal(formatTechCardDisplayNumber("1310-1", 0), "1310-1");
});

test("techCardVisibleNumber prefers API display_number", () => {
  assert.equal(
    techCardVisibleNumber({
      number: "1310-1",
      display_number: "1310-1/5",
      tech_cards_planned_count: 9,
    }),
    "1310-1/5",
  );
  assert.equal(
    techCardVisibleNumber({ number: "1310-1", tech_cards_planned_count: 3 }),
    "1310-1/3",
  );
});
