import assert from "node:assert/strict";
import test from "node:test";

import { defaultCapacityResource } from "../tech-operation-capacity.ts";
import {
  UNKNOWN_CAPACITY,
  capacityLoadDates,
  capacityWeekDates,
  filterCapacityRows,
  liveCapacityRows,
  resourceAfterException,
  resourceAfterExceptionRemoval,
  resourceConfigured,
  resourcesAfterSave,
} from "./capacity-live.ts";

function labor(patch = {}) {
  return { ...defaultCapacityResource("sewers", 4), name: "Швеи", hours_per_day: "10", resource_count: 4, ...patch };
}

function machine(patch = {}) {
  return {
    ...defaultCapacityResource("plotter_1", 3),
    name: "Плоттер",
    resource_type: "machine",
    capacity_unit: "linear_meter",
    calculation_mode: "rate",
    base_rate: "15",
    hours_per_day: "10",
    resource_count: null,
    work_center_id: 4,
    ...patch,
  };
}

const stages = [{ id: 4, name: "Пошив" }, { id: 3, name: "Печать" }];
const centers = [{ id: 4, name: "Epson", production_stage_id: 3 }, { id: 9, name: "Пустой станок", production_stage_id: 3 }];
const operations = [{ id: 2, capacity_resource_keys: ["plotter_1"] }, { id: 3, capacity_resource_keys: ["sewers"] }];

test("saved resource and exception replace the previous row and a failed save keeps it", () => {
  const current = labor();
  const saved = { ...current, hours_per_day: "8", exceptions: [] };
  const ok = resourcesAfterSave([current], { ok: true, resource: saved });
  assert.equal(ok.error, "");
  assert.equal(ok.resources[0].hours_per_day, "8");
  const failed = resourcesAfterSave(ok.resources, { ok: false, message: "Часы и смены вместе не больше 24 часов" });
  assert.equal(failed.error, "Часы и смены вместе не больше 24 часов");
  assert.equal(failed.resources[0].hours_per_day, "8");
  const withException = resourceAfterException(saved, {
    ok: true,
    exception: { date: "2026-10-07", unavailable: true, capacity: null, note: "ремонт" },
  });
  assert.equal(withException.resource.exceptions[0].note, "ремонт");
  const replaced = resourceAfterException(withException.resource, {
    ok: true,
    exception: { date: "2026-10-07", unavailable: false, capacity: "4", note: null },
  });
  assert.equal(replaced.resource.exceptions.length, 1);
  assert.equal(replaced.resource.exceptions[0].capacity, "4");
  const kept = resourceAfterException(replaced.resource, { ok: false, message: "Ошибка API (422)" });
  assert.equal(kept.resource.exceptions[0].capacity, "4");
  const removed = resourceAfterExceptionRemoval(replaced.resource, { ok: true, date: "2026-10-07" });
  assert.equal(removed.resource.exceptions.length, 0);
});

test("labor occupancy stays unknown, including zero and a nonworking day", () => {
  const rows = liveCapacityRows({
    resources: [labor(), labor({ key: "designers", name: "Дизайн", hours_per_day: null, working_days: [] })],
    stages,
    workCenters: centers,
    operations,
    loads: [],
    date: "2026-10-11",
  });
  const sewers = rows.find((row) => row.key === "sewers");
  assert.equal(sewers.availableLabel, UNKNOWN_CAPACITY);
  assert.equal(sewers.occupiedLabel, UNKNOWN_CAPACITY);
  assert.equal(sewers.remainingLabel, UNKNOWN_CAPACITY);
  assert.equal(sewers.utilizationLabel, UNKNOWN_CAPACITY);
  assert.equal(sewers.statusLabel, "Нерабочий день");
  assert.equal(sewers.overloaded, false);
  assert.equal(sewers.availableLabel.includes("0"), false);
  assert.equal(sewers.utilizationLabel.includes("%"), false);
  const designers = rows.find((row) => row.key === "designers");
  assert.equal(designers.configured, false);
  assert.equal(designers.statusLabel, "Не настроено");
  assert.equal(resourceConfigured(labor()), true);
});

test("equipment uses the day-load fields for overload, zero and an unavailable machine", () => {
  const unavailable = {
    ...machine(),
    exceptions: [{ date: "2026-10-07", unavailable: true, capacity: null, note: null }],
  };
  const rows = liveCapacityRows({
    resources: [unavailable, labor()],
    stages,
    workCenters: centers,
    operations,
    loads: [{
      work_center_id: 4,
      date: "2026-10-07",
      configured_capacity: "0",
      allocated: "0",
      remaining: "0",
      utilization_percent: null,
      capacity_unit: "linear_meter",
    }],
    date: "2026-10-07",
  });
  const plotter = rows.find((row) => row.key === "plotter_1");
  assert.equal(plotter.name, "Epson");
  assert.equal(plotter.kind, "work_center");
  assert.equal(plotter.statusLabel, "Недоступен");
  assert.equal(plotter.availableLabel, "0 м.п.");
  assert.equal(plotter.utilizationLabel, UNKNOWN_CAPACITY);
  assert.equal(plotter.overloaded, false);
  const overloaded = liveCapacityRows({
    resources: [machine()],
    stages,
    workCenters: centers,
    operations,
    loads: [{
      work_center_id: 4,
      date: "2026-10-07",
      configured_capacity: "150",
      allocated: "180",
      remaining: "0",
      utilization_percent: "120",
      capacity_unit: "linear_meter",
    }],
    date: "2026-10-07",
  });
  assert.equal(overloaded[0].utilizationLabel, "120%");
  const zeroPercent = liveCapacityRows({
    resources: [machine({ key: "work_center_2", work_center_id: 2 })],
    stages,
    workCenters: [{ id: 2, name: "Каландр", production_stage_id: 3 }],
    operations,
    loads: [{
      work_center_id: 2,
      date: "2026-10-20",
      configured_capacity: "480.000000000000",
      allocated: "0",
      remaining: "480.000000000000",
      utilization_percent: "0E+12",
      capacity_unit: "linear_meter",
    }],
    date: "2026-10-20",
  });
  assert.equal(zeroPercent[0].availableLabel, "480 м.п.");
  assert.equal(zeroPercent[0].occupiedLabel, "0 м.п.");
  assert.equal(zeroPercent[0].remainingLabel, "480 м.п.");
  assert.equal(zeroPercent[0].utilizationLabel, "0%");
  assert.equal(zeroPercent[0].overloaded, false);
  assert.equal(overloaded[0].overloaded, true);
  assert.equal(overloaded[0].occupiedLabel, "180 м.п.");
  const laborRow = rows.find((row) => row.key === "sewers");
  assert.equal(laborRow.utilizationLabel, UNKNOWN_CAPACITY);
  assert.notEqual(laborRow.unitLabel, plotter.unitLabel);
});

test("unconfigured equipment stays unknown and filters do not invent a mixed percent", () => {
  const rows = liveCapacityRows({
    resources: [machine()],
    stages,
    workCenters: centers,
    operations,
    loads: [],
    date: "2026-10-07",
  });
  const bare = rows.find((row) => row.key === "work-center:9");
  assert.equal(bare.configured, false);
  assert.equal(bare.resourceKey, null);
  assert.equal(bare.availableLabel, UNKNOWN_CAPACITY);
  assert.equal(bare.utilizationLabel, UNKNOWN_CAPACITY);
  const overload = filterCapacityRows(rows, { stageId: "all", kind: "all", setup: "all", overloadOnly: true });
  assert.equal(overload.length, 0);
  const equipment = filterCapacityRows(rows, { stageId: 3, kind: "work_center", setup: "unconfigured", overloadOnly: false });
  assert.deepEqual(equipment.map((row) => row.key), ["work-center:9"]);
});

test("date switching loads one day and the week strip follows the selected date", () => {
  assert.deepEqual(capacityLoadDates("2026-10-07"), ["2026-10-07"]);
  assert.deepEqual(capacityLoadDates("2026-10-08"), ["2026-10-08"]);
  assert.equal(capacityLoadDates("nope").length, 0);
  assert.deepEqual(capacityWeekDates("2026-10-07"), ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
  assert.equal(capacityWeekDates("2026-10-12")[0], "2026-10-12");
  assert.equal(capacityLoadDates("2026-10-12").length, 1);
});
