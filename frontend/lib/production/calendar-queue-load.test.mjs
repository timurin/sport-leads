import assert from "node:assert/strict";
import test from "node:test";
import { loadQueueLoads, parseQueueLoad, queueDemands, queueLoadCellKey, queueLoadLabel } from "./calendar-queue-load.ts";

const resource = { key: "sewers", name: "Пошив", production_stage_id: 4, unit: "person_hours" };
const board = { stages: [{ id: 4, code: "sewing" }], assignments: [{ id: 1, technical_card_id: 21, quantity: "64.000", production_stage_id: 4, planned_date: "2026-10-05" }] };
const response = (state = "reserve", changes = {}) => ({ resource_key: "sewers", date: "2026-10-05", unit: "person_hours",
  capacity: "8", known_planned_hours: "0", unknown_demand_count: 0, load_percent: "0", state, reason: null, warning_only: true, ...changes });

test("four states render backend values without recomputing thresholds", () => {
  assert.equal(queueLoadLabel(parseQueueLoad(response("reserve", { load_percent: "42" }), resource, "2026-10-05")), "Есть резерв · 42%");
  assert.equal(queueLoadLabel(parseQueueLoad(response("near", { load_percent: "80" }), resource, "2026-10-05")), "Близко к пределу · 80%");
  assert.equal(queueLoadLabel(parseQueueLoad(response("over", { load_percent: "160" }), resource, "2026-10-05")), "Перегрузка · 160%");
  // State is authoritative even if a future API returns an unexpected percentage.
  assert.equal(queueLoadLabel(parseQueueLoad(response("over", { load_percent: "42" }), resource, "2026-10-05")), "Перегрузка · 42%");
  assert.equal(queueLoadLabel(parseQueueLoad(response("unknown", { load_percent: "0", unknown_demand_count: 1 }), resource, "2026-10-05")), "Недостаточно данных");
  assert.equal(queueLoadLabel(parseQueueLoad(response("over", { load_percent: null, capacity: "0" }), resource, "2026-10-05")), "Перегрузка");
});

test("adapter forwards existing facts and never fabricates hours, meters, cutting method or machine allocation", () => {
  assert.deepEqual(queueDemands(resource, board.assignments), [{ unit: "person_hours", technical_card_id: 21 }]);
  assert.deepEqual(queueDemands({ ...resource, key: "packing_team", unit: "team_hours" }, board.assignments), [{ unit: "team_hours", quantity: "64.000" }]);
  for (const key of ["designers", "print_operator", "plotter_1", "calender", "cutters", "laser", "laser_operator"]) {
    assert.deepEqual(queueDemands({ ...resource, key }, board.assignments), [{ unit: "person_hours" }]);
  }
  assert.deepEqual(queueDemands(resource, []), []);
});

test("empty day asks backend with no demands instead of manufacturing zero/free capacity", async () => {
  const calls = [];
  const request = async (path, init) => {
    calls.push({ path, init });
    if (path === "/capacity/settings") return { resources: [resource] };
    const payload = JSON.parse(init.body);
    return response("unknown", { date: payload.date, capacity: null, load_percent: null, reason: "capacity_unknown" });
  };
  const result = await loadQueueLoads(board, ["2026-10-06"], [4], request);
  assert.deepEqual(JSON.parse(calls[1].init.body).demands, []);
  assert.equal(result.cells[queueLoadCellKey(4, "2026-10-06")][0].load.state, "unknown");
  assert.equal(calls[1].init.method, "POST");
});

test("request count is per resource/date, not per assignment, and concurrency is bounded", async () => {
  const resources = Array.from({ length: 14 }, (_, i) => ({ ...resource, key: `resource_${i}` }));
  const days = Array.from({ length: 7 }, (_, i) => `2026-10-${String(5 + i).padStart(2, "0")}`);
  let active = 0, maximum = 0, posts = 0;
  const request = async (path, init) => {
    if (path === "/capacity/settings") return { resources };
    active++; posts++; maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    const payload = JSON.parse(init.body);
    return response("unknown", { resource_key: payload.resource_key, date: payload.date, load_percent: null });
  };
  const result = await loadQueueLoads({ ...board, assignments: Array.from({ length: 100 }, () => board.assignments[0]) }, days, [4], request);
  assert.equal(posts, 98);
  assert.equal(maximum, 6);
  assert.equal(result.errorCount, 0);
  assert.equal(Object.keys(result.cells).length, 7);
});

test("separate resource states/units are retained without a fabricated section percentage", async () => {
  const resources = [resource, { ...resource, key: "laser", unit: "machine_hours" }];
  const request = async (path, init) => {
    if (path === "/capacity/settings") return { resources };
    const payload = JSON.parse(init.body);
    return response(payload.resource_key === "sewers" ? "near" : "unknown", {
      resource_key: payload.resource_key, unit: payload.resource_key === "sewers" ? "person_hours" : "machine_hours",
      load_percent: payload.resource_key === "sewers" ? "80" : null,
    });
  };
  const result = await loadQueueLoads(board, ["2026-10-05"], [4], request);
  assert.deepEqual(result.cells["4:2026-10-05"].map((entry) => entry.load.state), ["near", "unknown"]);
  assert.equal(Object.hasOwn(result.cells["4:2026-10-05"], "load_percent"), false);
});

test("failed or malformed indicators retain visible error and do not mutate assignments", async () => {
  const before = structuredClone(board);
  const request = async (path) => {
    if (path === "/capacity/settings") return { resources: [resource] };
    throw new Error("Нет связи с API загрузки");
  };
  const result = await loadQueueLoads(board, ["2026-10-05"], [4], request);
  assert.equal(result.errorCount, 1);
  assert.equal(result.cells["4:2026-10-05"][0].load, null);
  assert.match(result.cells["4:2026-10-05"][0].error, /Нет связи/);
  assert.deepEqual(board, before);
  for (const changes of [{ state: "free" }, { resource_key: "other" }, { unit: "machine_hours" }, { load_percent: "NaN" }, { unknown_demand_count: -1 }]) {
    assert.throws(() => parseQueueLoad(response("reserve", changes), resource, "2026-10-05"));
  }
});

test("over-capacity responses never gate mutations; indicator reads contain no queue mutations", async () => {
  const calls = [];
  const request = async (path, init) => {
    calls.push({ path, init });
    return path === "/capacity/settings" ? { resources: [resource] } : response("over", { load_percent: "160" });
  };
  const result = await loadQueueLoads(board, ["2026-10-05"], [4], request);
  assert.equal(result.cells["4:2026-10-05"][0].load.state, "over");
  assert.equal(result.cells["4:2026-10-05"][0].load.warning_only, true);
  assert.equal(calls.some(({ path }) => path.startsWith("/assignments")), false);
});

test("unsupported stage and oversized day stay explicit instead of partial or guessed loads", async () => {
  let posts = 0;
  const request = async (path) => {
    if (path === "/capacity/settings") return { resources: [resource] };
    posts++; return response();
  };
  const missing = await loadQueueLoads(board, ["2026-10-05"], [99], request);
  assert.deepEqual(missing.cells["99:2026-10-05"], []);
  const large = await loadQueueLoads({ ...board, assignments: Array.from({ length: 101 }, () => board.assignments[0]) }, ["2026-10-05"], [4], request);
  assert.equal(posts, 0);
  assert.match(large.cells["4:2026-10-05"][0].error, /Более 100/);
});

test("cancelled week/filter load stops queued jobs and forwards the abort signal", async () => {
  const controller = new AbortController();
  const request = async (path, init) => {
    assert.equal(init.signal, controller.signal);
    if (path === "/capacity/settings") { controller.abort(); return { resources: [resource] }; }
    assert.fail("No load-state requests after abort");
  };
  await assert.rejects(loadQueueLoads(board, ["2026-10-05"], [4], request, controller.signal), /отменена/);
});
