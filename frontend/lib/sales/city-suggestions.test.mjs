import assert from "node:assert/strict";
import test from "node:test";

import {
  rankCitySuggestions,
  readPlatformCitySuggestionNames,
  toPlatformCitySuggestionsPath,
} from "../platform-city-suggestions.ts";

test("city suggestions start after two characters and prioritize prefixes", () => {
  assert.deepEqual(rankCitySuggestions("с", ["Самара"]), []);
  assert.deepEqual(
    rankCitySuggestions(
      "са",
      ["Красноярск", "Саратов", "Самара", "Александров"],
      3,
    ),
    ["Саратов", "Самара", "Александров"],
  );
});

test("city suggestions are case-insensitive and keep only valid API names", () => {
  assert.deepEqual(
    rankCitySuggestions("МОС", ["Москва", "Можайск"]),
    ["Москва"],
  );
  assert.deepEqual(
    rankCitySuggestions("Новый Спортивный Город", ["Москва"]),
    [],
  );
  assert.deepEqual(
    readPlatformCitySuggestionNames([
      { name: " Москва " },
      { name: "Самара" },
      { name: "" },
      null,
    ]),
    ["Москва", "Самара"],
  );
});

test("city suggestions path keeps the platform proxy contract", () => {
  assert.equal(
    toPlatformCitySuggestionsPath(" Самара ", 5),
    "/api/platform-directories/city-suggestions?q=%D0%A1%D0%B0%D0%BC%D0%B0%D1%80%D0%B0&limit=5",
  );
});
