import assert from "node:assert/strict";
import test from "node:test";

import { getCitySuggestions } from "../city-suggestions.ts";

test("city suggestions start after two characters and prioritize prefixes", () => {
  assert.deepEqual(getCitySuggestions("с"), []);
  assert.deepEqual(
    getCitySuggestions("са", ["Красноярск", "Саратов", "Самара", "Александров"], 3),
    ["Саратов", "Самара", "Александров"],
  );
});

test("city suggestions are case-insensitive and do not replace an unknown value", () => {
  assert.deepEqual(getCitySuggestions("МОС"), ["Москва"]);
  assert.deepEqual(getCitySuggestions("Новый Спортивный Город"), []);
});
