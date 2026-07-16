import assert from "node:assert/strict";
import test from "node:test";

import { moveKanbanCard } from "./kanban-state.ts";

test("applies the same cross-column move only once", () => {
  const columns = [
    {
      id: "new",
      title: "Новые",
      accentClass: "bg-blue-500",
      cards: [{ id: "lead-1", status: "new", title: "Лид 1" }],
    },
    {
      id: "contact",
      title: "Контакт",
      accentClass: "bg-cyan-500",
      cards: [],
    },
  ];
  const move = {
    cardId: "lead-1",
    targetColumnId: "contact",
    targetIndex: 0,
    visibleTargetCardIds: [],
  };

  const movedColumns = moveKanbanCard(columns, move);
  const repeatedColumns = moveKanbanCard(movedColumns, move);

  assert.deepEqual(columns.map((column) => column.cards.map((card) => card.id)), [["lead-1"], []]);
  assert.deepEqual(movedColumns.map((column) => column.cards.map((card) => card.id)), [[], ["lead-1"]]);
  assert.equal(movedColumns[1].cards[0].status, "contact");
  assert.strictEqual(repeatedColumns, movedColumns);
});
