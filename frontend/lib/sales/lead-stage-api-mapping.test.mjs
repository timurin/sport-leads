import assert from "node:assert/strict";
import test from "node:test";

import {
  fromApiLeadStage,
  toApiLeadStageConfiguration,
} from "./lead-stage-api-mapping.ts";

test("maps persistent stage configuration without changing stable ids", () => {
  const stage = fromApiLeadStage({
    id: "custom-7",
    title: "Тестовая стадия",
    accent_class: "bg-slate-500",
    is_active: true,
    sort_order: 3,
    is_system: false,
  });

  assert.equal(stage.id, "custom-7");
  assert.equal(stage.title, "Тестовая стадия");
  assert.deepEqual(toApiLeadStageConfiguration([stage], { "custom-7": "new" }), {
    stages: [{
      id: "custom-7",
      title: "Тестовая стадия",
      accent_class: "bg-slate-500",
      is_active: true,
      sort_order: 3,
    }],
    transfers: { "custom-7": "new" },
  });
});
