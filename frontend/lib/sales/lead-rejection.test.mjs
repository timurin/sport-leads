import assert from "node:assert/strict";
import test from "node:test";

import { findBackendReasonId } from "./lead-rejection.ts";

test("maps frontend rejection reason codes to active backend ids", () => {
  const reasons = [
    { id: 7, code: "no_budget", name: "Нет бюджета", is_active: true },
    { id: 8, code: "other", name: "Другое", is_active: false },
  ];

  assert.equal(findBackendReasonId("no_budget", reasons), 7);
  assert.equal(findBackendReasonId("other", reasons), null);
  assert.equal(findBackendReasonId("missing", reasons), null);
});
