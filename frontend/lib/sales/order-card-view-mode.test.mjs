import assert from "node:assert/strict";
import test from "node:test";

import { getOrderCardSectionVisibility } from "./order-card-view-mode.ts";

test("all mode shows every order card section including documents and tech cards", () => {
  const visibility = getOrderCardSectionVisibility("all");
  assert.equal(visibility.info, true);
  assert.equal(visibility.metrics, true);
  assert.equal(visibility.items, true);
  assert.equal(visibility.history, true);
  assert.equal(visibility.comments, true);
  assert.equal(visibility.tasks, true);
  assert.equal(visibility.communication, true);
  assert.equal(visibility.documents, true);
  assert.equal(visibility.techCards, true);
});

test("info mode keeps only requisites and metrics", () => {
  const visibility = getOrderCardSectionVisibility("info");
  assert.deepEqual(visibility, {
    info: true,
    metrics: true,
    items: false,
    history: false,
    comments: false,
    tasks: false,
    communication: false,
    documents: false,
    techCards: false,
  });
});

test("items mode keeps Товары and line-adjacent tech cards strip", () => {
  const visibility = getOrderCardSectionVisibility("items");
  assert.equal(visibility.items, true);
  assert.equal(visibility.techCards, true);
  assert.equal(visibility.info, false);
  assert.equal(visibility.documents, false);
});

test("communication, documents and techCards modes stay exclusive", () => {
  assert.equal(getOrderCardSectionVisibility("communication").communication, true);
  assert.equal(getOrderCardSectionVisibility("documents").documents, true);
  assert.equal(getOrderCardSectionVisibility("documents").techCards, false);
  assert.equal(getOrderCardSectionVisibility("techCards").techCards, true);
  assert.equal(getOrderCardSectionVisibility("techCards").documents, false);
  assert.equal(getOrderCardSectionVisibility("techCards").items, false);
});
