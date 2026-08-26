import assert from "node:assert/strict";
import test from "node:test";

import {
  getOrderCardSectionVisibility,
  orderCardViewModeOptions,
} from "./order-card-view-mode.ts";

test("filter toolbar keeps Коммуникация; drops Сведения", () => {
  const ids = orderCardViewModeOptions.map((option) => option.id);
  assert.deepEqual(ids, ["all", "items", "documents", "techCards", "communication"]);
  assert.equal(orderCardViewModeOptions.find((option) => option.id === "all")?.label, "Документ");
  assert.equal(
    orderCardViewModeOptions.find((option) => option.id === "communication")?.label,
    "Коммуникация",
  );
});

test("document (all) mode shows items+metrics; party/CRM off left stack", () => {
  const visibility = getOrderCardSectionVisibility("all");
  assert.equal(visibility.info, false);
  assert.equal(visibility.metrics, true);
  assert.equal(visibility.items, true);
  assert.equal(visibility.history, false);
  assert.equal(visibility.comments, false);
  assert.equal(visibility.tasks, false);
  assert.equal(visibility.communication, false);
  assert.equal(visibility.documents, false);
  assert.equal(visibility.techCards, false);
});

test("items mode keeps Товары, metrics rail, and line-adjacent tech cards", () => {
  const visibility = getOrderCardSectionVisibility("items");
  assert.equal(visibility.items, true);
  assert.equal(visibility.metrics, true);
  assert.equal(visibility.techCards, true);
  assert.equal(visibility.info, false);
  assert.equal(visibility.documents, false);
});

test("communication filter shows only order chat + finance rail", () => {
  const visibility = getOrderCardSectionVisibility("communication");
  assert.equal(visibility.communication, true);
  assert.equal(visibility.metrics, true);
  assert.equal(visibility.items, false);
  assert.equal(visibility.techCards, false);
  assert.equal(visibility.documents, false);
  assert.equal(visibility.history, false);
});

test("finance metrics stay visible in exclusive filter modes (22.2)", () => {
  for (const mode of ["documents", "techCards", "items", "all", "communication"]) {
    assert.equal(
      getOrderCardSectionVisibility(mode).metrics,
      true,
      `metrics must stay on for ${mode}`,
    );
  }
});

test("documents and techCards modes stay exclusive", () => {
  assert.equal(getOrderCardSectionVisibility("documents").documents, true);
  assert.equal(getOrderCardSectionVisibility("documents").techCards, false);
  assert.equal(getOrderCardSectionVisibility("techCards").techCards, true);
  assert.equal(getOrderCardSectionVisibility("techCards").documents, false);
  assert.equal(getOrderCardSectionVisibility("techCards").items, false);
});
