import assert from "node:assert/strict";
import test from "node:test";
import { techCardListPresentation } from "./tech-cards.ts";
import { buildShopStageKanbanColumns, shopCurrentFactStatus } from "./shop-stage-modules.ts";

test("PC-05.8 list and Kanban consume canonical state over stale fields", () => {
  const card = { id: 1, number: "TK-1", quantity: 4, status: "draft", current_stage_label: "Design", current_workshop_id: 1,
    production_state: { lifecycle_status: "planned", current_workshop_id: 3, current_workshop_name: "Print", workshop_state: "waiting" } };
  assert.deepEqual(techCardListPresentation(card), { statusLabel: "Запланирована", workshopLabel: "Print" });
  assert.equal(shopCurrentFactStatus(card), "pending");
  const modules = [{ workshopId: 1, code: "design", title: "Design", href: "/design" }, { workshopId: 3, code: "print", title: "Print", href: "/print" }];
  const columns = buildShopStageKanbanColumns([card], modules);
  assert.equal(columns.flatMap(column => column.cards).length, 1);
  assert.equal(columns.find(column => column.id === "print")?.cards.length, 1);
  card.production_state.lifecycle_status = "completed";
  card.production_state.current_workshop_id = null;
  assert.equal(buildShopStageKanbanColumns([card], modules).flatMap(column => column.cards).length, 0);
});
