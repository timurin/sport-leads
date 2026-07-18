import assert from "node:assert/strict";
import test from "node:test";

import {
  getLeadStagePersistenceDecision,
  resolveLeadStageAfterPersistence,
} from "./lead-stage-persistence.ts";

test("persists changed stages for numeric API leads only", () => {
  assert.deepEqual(
    getLeadStagePersistenceDecision("42", "new", "contact", "api"),
    { shouldPersist: true, reason: "api-lead" },
  );
  assert.equal(
    getLeadStagePersistenceDecision("lead-1", "new", "contact", "demo").shouldPersist,
    false,
  );
  assert.equal(
    getLeadStagePersistenceDecision("42", "new", "new", "api").reason,
    "unchanged",
  );
  assert.deepEqual(
    getLeadStagePersistenceDecision("42", "new", "custom-1", "api"),
    { shouldPersist: true, reason: "api-lead" },
  );
});

test("failed persistence resolves the optimistic stage back to its snapshot", () => {
  assert.equal(resolveLeadStageAfterPersistence("new", "contact", true), "contact");
  assert.equal(resolveLeadStageAfterPersistence("new", "contact", false), "new");
});
