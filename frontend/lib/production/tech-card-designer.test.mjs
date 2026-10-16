import assert from "node:assert/strict";
import test from "node:test";

import {
  DESIGN_REVIEW_MESSAGE,
  designElapsedSeconds,
  formatDesignDuration,
  isDesignReviewSubmitted,
  notesWithDesignReview,
  personalizationSpreadsheetXml,
} from "./tech-card-designer.ts";

test("design review marker is stored once in stage notes", () => {
  assert.equal(notesWithDesignReview(null), DESIGN_REVIEW_MESSAGE);
  assert.equal(notesWithDesignReview("  "), DESIGN_REVIEW_MESSAGE);
  const once = notesWithDesignReview("Комментарий");
  assert.equal(notesWithDesignReview(once), once);
  assert.equal(isDesignReviewSubmitted(once), true);
  assert.equal(isDesignReviewSubmitted("ещё нет"), false);
});

test("design timer counts from start until complete", () => {
  const now = new Date("2026-10-15T12:00:30Z");
  assert.equal(designElapsedSeconds(null, null, now), null);
  assert.equal(
    designElapsedSeconds("2026-10-15T12:00:00Z", null, now),
    30,
  );
  assert.equal(
    designElapsedSeconds("2026-10-15T11:00:00Z", "2026-10-15T11:01:05Z", now),
    65,
  );
  assert.equal(formatDesignDuration(65), "1 мин 5 сек");
  assert.equal(formatDesignDuration(3700), "1 ч 1 мин");
});

test("personalization excel includes every unit row", () => {
  const xml = personalizationSpreadsheetXml([
    {
      id: 2,
      technical_card_id: 161,
      unit_index: 2,
      size_type: "female",
      size: "M",
      personalization: "Иванова",
      print_number: "10",
      color: null,
      notes: "A & B",
    },
    {
      id: 1,
      technical_card_id: 161,
      unit_index: 1,
      size: "S",
      personalization: "Петров",
    },
  ]);
  const first = xml.indexOf("Петров");
  const second = xml.indexOf("Иванова");
  assert.ok(first > 0 && second > first);
  assert.match(xml, /Персонализация/);
  assert.match(xml, /A &amp; B/);
  assert.match(xml, /Женский|female/);
});
