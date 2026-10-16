import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  completeTechnicalCardStage,
  rollbackTechnicalCardStageKanban,
  startTechnicalCardStage,
} from "../sales/order-tech-cards-api.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function mockFetch(status, body) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, startMarker);
  assert.ok(end > start, endMarker);
  return source.slice(start, end);
}

test("authenticated complete sends the session cookie and returns the card", async () => {
  const mock = mockFetch(200, {
    id: 157,
    status: "in_progress",
    current_stage_label: "Печать",
  });
  try {
    const card = await completeTechnicalCardStage(157, 1, {}, { Cookie: "sl_session=token" });
    assert.equal(card.current_stage_label, "Печать");
    assert.equal(mock.calls.length, 1);
    assert.match(String(mock.calls[0].url), /\/technical-cards\/157\/stages\/1\/complete$/);
    assert.equal(mock.calls[0].init.method, "POST");
    assert.equal(mock.calls[0].init.headers.Cookie, "sl_session=token");
    assert.equal(mock.calls[0].init.headers["content-type"], "application/json");
  } finally {
    mock.restore();
  }
});

test("complete without a session surfaces the auth error", async () => {
  const mock = mockFetch(401, { detail: "Требуется вход" });
  try {
    await assert.rejects(
      () => completeTechnicalCardStage(157, 1, {}),
      (error) => error instanceof Error && error.message === "Требуется вход",
    );
    assert.equal(mock.calls[0].init.headers.Cookie, undefined);
  } finally {
    mock.restore();
  }
});

test("complete without permission surfaces the permission error", async () => {
  const mock = mockFetch(403, { detail: "Недостаточно прав: shop.kanban.transition" });
  try {
    await assert.rejects(
      () => completeTechnicalCardStage(157, 1, {}, { Cookie: "sl_session=limited" }),
      (error) =>
        error instanceof Error && error.message === "Недостаточно прав: shop.kanban.transition",
    );
  } finally {
    mock.restore();
  }
});

test("guarded kanban rollback sends the session cookie", async () => {
  const mock = mockFetch(200, { id: 157, status: "in_progress" });
  try {
    await rollbackTechnicalCardStageKanban(157, 1, { Cookie: "sl_session=token" });
    assert.match(String(mock.calls[0].url), /\/stages\/1\/rollback-kanban$/);
    assert.equal(mock.calls[0].init.headers.Cookie, "sl_session=token");
    assert.equal(mock.calls[0].init.body, undefined);
  } finally {
    mock.restore();
  }
});

test("stage start still succeeds without a session cookie", async () => {
  const mock = mockFetch(200, { id: 157, status: "in_progress" });
  try {
    const card = await startTechnicalCardStage(157, 1, {});
    assert.equal(card.status, "in_progress");
    assert.equal(mock.calls[0].init.headers.Cookie, undefined);
    assert.match(String(mock.calls[0].url), /\/stages\/1\/start$/);
  } finally {
    mock.restore();
  }
});

test("complete and kanban rollback actions forward the session; kanban refreshes only after success", () => {
  const actions = readFileSync(
    join(root, "app/(workspace)/production/tech-cards/tech-card-actions.ts"),
    "utf8",
  );
  const complete = sliceBetween(
    actions,
    "export async function completeTechnicalCardStageAction",
    "export async function rollbackTechnicalCardStageAction",
  );
  assert.match(complete, /const auth = await sessionAuthHeaders\(\)/);
  assert.match(complete, /completeTechnicalCardStage\(cardId, stageOrder, payload, auth\)/);

  const kanbanRollback = sliceBetween(
    actions,
    "export async function rollbackTechnicalCardStageKanbanAction",
    "export async function applyRoutingAction",
  );
  assert.match(kanbanRollback, /const auth = await sessionAuthHeaders\(\)/);
  assert.match(kanbanRollback, /rollbackTechnicalCardStageKanban\(cardId, stageOrder, auth\)/);

  const start = sliceBetween(
    actions,
    "export async function startTechnicalCardStageAction",
    "export async function completeTechnicalCardStageAction",
  );
  assert.equal(start.includes("sessionAuthHeaders"), false);

  const kanban = readFileSync(
    join(root, "components/production/shop-stage-kanban-workspace.tsx"),
    "utf8",
  );
  const failureReturn = kanban.indexOf("if (!result.ok)");
  const refresh = kanban.indexOf("router.refresh()");
  assert.ok(failureReturn > 0);
  assert.ok(refresh > failureReturn);
});
