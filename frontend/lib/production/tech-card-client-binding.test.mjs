import assert from "node:assert/strict";
import test from "node:test";

import {
  clientCreateAllowed,
  clientShareDecision,
} from "./tech-card-client-binding.ts";

test("client create stays available unless the directory forbids it", () => {
  assert.equal(clientCreateAllowed(null), true);
  assert.equal(clientCreateAllowed(200), true);
  assert.equal(clientCreateAllowed(401), false);
  assert.equal(clientCreateAllowed(403), false);
});

test("unchanged client does not ask to rewrite the shared parent", () => {
  const decision = clientShareDecision({
    savedClientId: 4,
    nextClientId: 4,
    siblingCount: 3,
    contour: "group",
  });
  assert.equal(decision.changed, false);
  assert.equal(decision.confirm, false);
});

test("several cards require an explicit confirmation", () => {
  const decision = clientShareDecision({
    savedClientId: 4,
    nextClientId: 9,
    siblingCount: 2,
    contour: "order",
  });
  assert.equal(decision.confirm, true);
  assert.match(decision.message, /2 техкарт/);
  assert.match(decision.message, /заказа/);
});

test("a single card explains the parent without a confirmation gate", () => {
  const decision = clientShareDecision({
    savedClientId: null,
    nextClientId: 9,
    siblingCount: 1,
    contour: "group",
  });
  assert.equal(decision.confirm, false);
  assert.match(decision.message, /группы/);
});

test("unknown sibling count blocks a silent reassignment", () => {
  const decision = clientShareDecision({
    savedClientId: 1,
    nextClientId: null,
    siblingCount: null,
    contour: "group",
  });
  assert.equal(decision.confirm, true);
  assert.match(decision.message, /Не удалось проверить/);
});

test("a new standalone group does not warn before the first card", () => {
  const decision = clientShareDecision({
    savedClientId: null,
    nextClientId: 9,
    siblingCount: 0,
    contour: "group",
  });
  assert.equal(decision.confirm, false);
  assert.equal(decision.message, null);
});
