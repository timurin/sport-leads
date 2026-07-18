import assert from "node:assert/strict";
import test from "node:test";

import { resolveLeadDetailStage } from "./lead-detail-stage.ts";

test("keeps a custom backend stage as the detail-card stage after reload", () => {
  assert.deepEqual(resolveLeadDetailStage("custom-7"), {
    status: "custom-7",
    stageId: "custom-7",
  });
});

test("keeps completed as a final state rather than a working stage", () => {
  assert.deepEqual(resolveLeadDetailStage("completed"), { status: "completed" });
});
