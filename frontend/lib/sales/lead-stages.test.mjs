import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LEAD_STAGES,
  getActiveLeadStages,
  getDefaultLeadStages,
  getStageDeactivationIssue,
  loadLeadStages,
  parseStoredLeadStages,
  renameLeadStage,
  sortLeadStages,
  validateLeadStages,
} from "./lead-stages.ts";

test("validates stage configuration and rejects duplicate or reserved ids", () => {
  const valid = getDefaultLeadStages();
  const duplicate = [...valid, { ...valid[0] }];
  const systemResult = [{ ...valid[0], id: "converted" }, ...valid.slice(1)];

  assert.equal(validateLeadStages(valid), true);
  assert.equal(validateLeadStages(duplicate), false);
  assert.equal(validateLeadStages(systemResult), false);
});

test("restores defaults for empty or corrupted storage data", () => {
  assert.deepEqual(parseStoredLeadStages(null), DEFAULT_LEAD_STAGES);
  assert.deepEqual(parseStoredLeadStages("{broken"), DEFAULT_LEAD_STAGES);
  assert.deepEqual(parseStoredLeadStages(JSON.stringify([{ id: "new" }])), DEFAULT_LEAD_STAGES);
  assert.deepEqual(loadLeadStages({ getItem: () => { throw new Error("blocked"); } }), DEFAULT_LEAD_STAGES);
});

test("sorts stages and exposes only active custom and default stages", () => {
  const stages = [
    { ...DEFAULT_LEAD_STAGES[0], isActive: false, sortOrder: 3 },
    { ...DEFAULT_LEAD_STAGES[1], sortOrder: 2 },
    {
      id: "custom-1",
      title: "Согласование",
      accentClass: "bg-rose-500",
      isActive: true,
      sortOrder: 1,
      isSystem: false,
    },
  ];

  assert.deepEqual(sortLeadStages(stages).map((stage) => stage.id), ["custom-1", "contact", "new"]);
  assert.deepEqual(getActiveLeadStages(stages).map((stage) => stage.id), ["custom-1", "contact"]);
});

test("renaming a stage preserves its id", () => {
  const stages = renameLeadStage(getDefaultLeadStages(), "contact", "Первый звонок");

  assert.equal(stages[1].id, "contact");
  assert.equal(stages[1].title, "Первый звонок");
});

test("prevents disabling the last active stage", () => {
  const stages = getDefaultLeadStages().map((stage, index) => ({
    ...stage,
    isActive: index === 0,
  }));

  assert.equal(getStageDeactivationIssue(stages, "new", [], undefined), "last-active-stage");
});

test("requires a valid transfer when a disabled stage contains leads", () => {
  const stages = getDefaultLeadStages();
  const leadStages = ["new", "contact"];

  assert.equal(getStageDeactivationIssue(stages, "new", leadStages), "transfer-required");
  assert.equal(getStageDeactivationIssue(stages, "new", leadStages, "new"), "invalid-transfer-stage");
  assert.equal(getStageDeactivationIssue(stages, "new", leadStages, "contact"), null);
});
