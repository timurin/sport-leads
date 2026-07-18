import assert from "node:assert/strict";
import test from "node:test";

import { leadFinalActions } from "./lead-final-actions.ts";

test("keeps conversion and rejection outside editable working stages", () => {
  assert.deepEqual(leadFinalActions, [
    { id: "convert", title: "Оформить заказ" },
    { id: "reject", title: "Закрыть с отказом" },
  ]);
  assert.equal(Object.isFrozen(leadFinalActions), true);
  assert.equal(leadFinalActions.every(Object.isFrozen), true);
});
