import assert from "node:assert/strict";
import test from "node:test";

import {
  DEMO_STAGE_EXECUTOR_OPTIONS,
  stageExecutorsToOptions,
} from "../lib/stage-executors.ts";

test("stageExecutorsToOptions uses display_name as value", () => {
  const options = stageExecutorsToOptions([
    {
      id: 1,
      login: "ops",
      display_name: "Оператор",
      is_active: true,
    },
  ]);
  assert.deepEqual(options, [
    { value: "Оператор", label: "Оператор (ops)" },
  ]);
});

test("demo fallback options are non-empty", () => {
  assert.ok(DEMO_STAGE_EXECUTOR_OPTIONS.length >= 3);
});
