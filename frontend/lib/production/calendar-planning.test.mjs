import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarAssignmentId, calendarAssignmentInput, calendarBoardPath, calendarDate,
  calendarPlanningPath, calendarRequest, calendarWeekPath,
} from "./calendar.ts";

const assignment = {
  id: 17, technical_card_id: 6, technical_card_number: "TC-6", order_number: "ORDER-2",
  nomenclature_name: "Форма", quantity: "12.000", production_stage_id: 3,
  production_stage_name: "Пошив", planned_date: "2026-10-11", position: 4, note: "Приоритет",
};

test("planning deep link carries ID/date and queue return carries destination week", () => {
  assert.equal(calendarPlanningPath(assignment.planned_date, assignment.id), "/production/calendar/planning?date=2026-10-11&assignment=17");
  assert.equal(calendarPlanningPath("2026-10-12"), "/production/calendar/planning?date=2026-10-12");
  assert.equal(calendarWeekPath("2026-10-12"), "/production/calendar?date=2026-10-12");
  assert.equal(calendarBoardPath(assignment.planned_date), "/board?from=2026-10-05&to=2026-10-11");
  assert.equal(calendarBoardPath("2026-10-12"), "/board?from=2026-10-12&to=2026-10-18");
});

test("planning query validation rejects impossible dates, duplicate query values and invalid IDs", () => {
  assert.equal(calendarDate("2028-02-29"), "2028-02-29");
  for (const value of [undefined, "", "bad", "2026-02-29", "2026-04-31", "2026-1-01", ["2026-10-12"]]) {
    assert.equal(calendarDate(value), null);
  }
  assert.equal(calendarAssignmentId("17"), 17);
  for (const value of [undefined, "", "0", "-1", "17.5", "1e3", " 17", "9007199254740992", ["17"]]) {
    assert.equal(calendarAssignmentId(value), null);
  }
});

test("assignment prefill keeps editable fields and excludes source identity and quantity from PUT", () => {
  const input = calendarAssignmentInput(assignment);
  assert.deepEqual(input, { production_stage_id: 3, planned_date: "2026-10-11", position: 4, note: "Приоритет" });
  input.planned_date = "2026-10-12";
  assert.equal(assignment.planned_date, "2026-10-11");
  assert.equal(Object.hasOwn(input, "quantity"), false);
  assert.equal(Object.hasOwn(input, "technical_card_id"), false);
});

test("planning client loads selected assignment, saves move, and reads persisted destination week", async () => {
  const original = globalThis.fetch;
  let stored = structuredClone(assignment);
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (init.method === "PUT") {
      const payload = JSON.parse(init.body);
      assert.deepEqual(Object.keys(payload).sort(), ["note", "planned_date", "position", "production_stage_id"]);
      stored = { ...stored, ...payload, production_stage_name: "Печать" };
      return Response.json(stored);
    }
    const query = new URL(url, "http://localhost").searchParams;
    return Response.json({ assignments: stored.planned_date >= query.get("from") && stored.planned_date <= query.get("to") ? [stored] : [], stages: [] });
  };
  try {
    const board = await calendarRequest(calendarBoardPath(assignment.planned_date));
    const selected = board.assignments.find((row) => row.id === assignment.id);
    const payload = { ...calendarAssignmentInput(selected), planned_date: "2026-10-12", production_stage_id: 2, position: 8, note: "Позже" };
    const saved = await calendarRequest("/assignments/17", { method: "PUT", body: JSON.stringify(payload) });
    assert.equal(saved.id, assignment.id);
    assert.equal(saved.quantity, assignment.quantity);
    assert.equal(saved.technical_card_id, assignment.technical_card_id);
    const reload = await calendarRequest(calendarBoardPath(saved.planned_date));
    assert.deepEqual(reload.assignments[0], saved);
    const prior = await calendarRequest(calendarBoardPath(assignment.planned_date));
    assert.deepEqual(prior.assignments, []);
    assert.equal(calls[1].url, "/api/production-calendar/assignments/17");
    assert.equal(calls[1].init.credentials, "include");
    assert.equal(calls[2].init.cache, "no-store");
  } finally { globalThis.fetch = original; }
});

test("planning failed save surfaces server conflict without replacing loaded assignment", async () => {
  const original = globalThis.fetch;
  const input = calendarAssignmentInput(assignment);
  globalThis.fetch = async () => Response.json({ detail: "Эта ТК уже назначена на участок" }, { status: 409 });
  try {
    await assert.rejects(calendarRequest("/assignments/17", { method: "PUT", body: JSON.stringify(input) }), /Эта ТК уже назначена/);
    assert.deepEqual(input, calendarAssignmentInput(assignment));
  } finally { globalThis.fetch = original; }
});
