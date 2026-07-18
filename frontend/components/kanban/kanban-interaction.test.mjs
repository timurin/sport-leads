import assert from "node:assert/strict";
import test from "node:test";

import {
  canStartKanbanDrag,
  isKanbanInteractiveTarget,
  shouldOpenKanbanCard,
} from "./kanban-interaction.ts";

function target(...matchedSelectors) {
  return {
    closest: (selector) => matchedSelectors.some(
      (matchedSelector) => selector === matchedSelector || selector.split(",").includes(matchedSelector),
    ) ? { selector } : null,
  };
}

test("starts dragging from free card content but not interactive descendants", () => {
  assert.equal(canStartKanbanDrag(target()), true);
  assert.equal(canStartKanbanDrag(target("button")), false);
  assert.equal(canStartKanbanDrag(target("a")), false);
  assert.equal(canStartKanbanDrag(target("a", "[data-kanban-card-link]")), true);
  assert.equal(isKanbanInteractiveTarget({ parentElement: target("input") }), true);
});

test("opens a card only for a normal non-drag click on free content", () => {
  assert.equal(shouldOpenKanbanCard(target(), false, "/sales/leads/1"), true);
  assert.equal(shouldOpenKanbanCard(target("button"), false, "/sales/leads/1"), false);
  assert.equal(shouldOpenKanbanCard(target(), true, "/sales/leads/1"), false);
  assert.equal(shouldOpenKanbanCard(target(), false), false);
});
