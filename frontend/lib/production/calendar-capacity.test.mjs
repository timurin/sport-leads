import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { calendarRequest } from "./calendar.ts";
import {
  capacitySections,
  deleteCapacityException,
  loadCapacitySettings,
  parseCapacitySettings,
  saveCapacityException,
  saveCapacitySettings,
  settingsPayload,
  validateException,
  validateSettings,
} from "./calendar-capacity.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const requiredNames = [
  "Дизайнеры",
  "Печатник / подготовка",
  "Плоттер 1",
  "Плоттер 2",
  "Плоттер 3",
  "Плоттер 4",
  "Каландр",
  "Оператор каландра",
  "Общий пул раскройщиков",
  "Лазер",
  "Оператор лазера",
  "Пошив",
  "Бригада упаковки",
  "Закупка",
];

function resource(overrides) {
  return {
    key: "designers",
    name: "Дизайнеры",
    stage_code: "design",
    production_stage_id: 1,
    stage_name: "Дизайн",
    stage_active: true,
    kind: "pool",
    unit: "person_hours",
    configured: true,
    work_center_id: null,
    staff_count: 5,
    hours_per_day: "8.0000",
    working_days: [0, 1, 2, 3, 4],
    note: null,
    base_capacity: "40.0000",
    editable_fields: ["staff_count", "hours_per_day", "working_days", "note"],
    norm: { source: "manual", rates: {}, required_staff_count: null },
    exceptions: [],
    ...overrides,
  };
}

function settings(resources) {
  return {
    resources,
    stages: [{ id: 1, name: "Дизайн", code: "design", is_active: true }, { id: 2, name: "Печать", code: "print", is_active: true }],
    work_centers: [{ id: 21, name: "Плоттер A", code: "P1", production_stage_id: 2, is_active: true }],
  };
}

function request(handler) {
  return async (path, init = {}) => {
    const response = await handler(path, init);
    if (!response.ok) {
      let message = "Ошибка календаря (" + response.status + ")";
      try {
        const body = await response.json();
        if (typeof body.detail === "string") message = body.detail;
        else if (Array.isArray(body.detail)) message = body.detail.map((item) => item.msg).join("; ");
      } catch { /* status remains visible */ }
      throw new Error(message);
    }
    return response.status === 204 ? undefined : await response.json();
  };
}

test("GET settings parses the live shape and keeps decimal strings", async () => {
  const body = settings([
    resource({ hours_per_day: 8, base_capacity: 40, norm: { source: "manual", rates: { running_meters_per_hour: 15 }, required_staff_count: null } }),
    resource({
      key: "procurement", name: "Закупка", stage_code: "procurement", stage_name: "Закупка", kind: "milestone", unit: "milestone",
      configured: false, staff_count: null, hours_per_day: null, working_days: [], base_capacity: null, editable_fields: [],
      norm: { source: "milestone", rates: {}, required_staff_count: null },
    }),
  ]);
  const loaded = await loadCapacitySettings(request(() => Response.json(body)));
  assert.equal(loaded.resources[0].hours_per_day, "8");
  assert.equal(loaded.resources[0].base_capacity, "40");
  assert.equal(loaded.resources[0].norm.rates.running_meters_per_hour, "15");
  assert.equal(loaded.resources[1].unit, "milestone");
  assert.equal(loaded.resources[1].editable_fields.length, 0);
  assert.deepEqual(capacitySections(loaded.resources).map((section) => section.section), ["Дизайн", "Закупка"]);
  assert.throws(() => parseCapacitySettings({ resources: "no" }), /не содержит настройки/);
});

test("missing capacity API is an error and does not invent resources", async () => {
  await assert.rejects(
    loadCapacitySettings(request(() => Response.json({ detail: "Неизвестный маршрут календаря" }, { status: 404 }))),
    /Неизвестный маршрут календаря/,
  );
  await assert.rejects(loadCapacitySettings(request(() => new Response("", { status: 500 }))), /500/);
});

test("save settings sends only the contract fields and keeps the other resources", async () => {
  const plotter = resource({
    key: "plotter_1", name: "Плоттер 1", stage_code: "print", production_stage_id: 2, stage_name: "Печать",
    kind: "machine", unit: "machine_hours", configured: false, staff_count: null, hours_per_day: null,
    working_days: [], base_capacity: null, work_center_id: null,
    editable_fields: ["work_center_id", "hours_per_day", "working_days", "note"],
    norm: { source: "confirmed_v0.1", rates: { running_meters_per_hour: "15" }, required_staff_count: null },
  });
  const designers = resource();
  const draft = { staff_count: null, hours_per_day: "10", working_days: [0, 1, 2, 3, 4], work_center_id: 21, note: "Плоттер A" };
  assert.equal(validateSettings(plotter, draft), null);
  let body;
  const saved = await saveCapacitySettings([designers, plotter], "plotter_1", draft, request((path, init) => {
    body = JSON.parse(init.body);
    assert.equal(path, "/capacity/settings/plotter_1");
    assert.equal(init.method, "PUT");
    return Response.json({ ...plotter, ...body, configured: true, base_capacity: "10" });
  }));
  assert.deepEqual(Object.keys(body).sort(), ["hours_per_day", "note", "staff_count", "work_center_id", "working_days"]);
  assert.equal(body.base_capacity, undefined);
  assert.equal(saved.find((item) => item.key === "plotter_1").base_capacity, "10");
  assert.equal(saved.find((item) => item.key === "designers").base_capacity, "40.0000");
});

test("create, update and delete an exception by resource key and date", async () => {
  const sewing = resource({
    key: "sewers", name: "Пошив", stage_code: "sewing", stage_name: "Пошив",
  });
  const draft = { capacity: "4", unavailable: false, note: "двое в отпуске" };
  assert.equal(validateException(sewing, "2026-10-20", draft), null);
  const calls = [];
  const api = request((path, init) => {
    calls.push({ path, method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
    if (init.method === "DELETE") return new Response(null, { status: 204 });
    return Response.json({ date: "2026-10-20", capacity: calls.length === 1 ? "4" : "2", unavailable: false, note: draft.note });
  });
  const created = await saveCapacityException([sewing], "sewers", "2026-10-20", draft, api);
  const updated = await saveCapacityException(created, "sewers", "2026-10-20", { capacity: "2", unavailable: false, note: draft.note }, api);
  assert.equal(updated.find((item) => item.key === "sewers").exceptions.length, 1);
  assert.equal(updated.find((item) => item.key === "sewers").exceptions[0].capacity, "2");
  const removed = await deleteCapacityException(updated, "sewers", "2026-10-20", api);
  assert.deepEqual(removed.find((item) => item.key === "sewers").exceptions, []);
  assert.deepEqual(calls.map((call) => call.path), [
    "/capacity/settings/sewers/exceptions/2026-10-20",
    "/capacity/settings/sewers/exceptions/2026-10-20",
    "/capacity/settings/sewers/exceptions/2026-10-20",
  ]);
  assert.deepEqual(calls[0].body, draft);
  assert.equal(calls[2].method, "DELETE");
});

test("reload returns the saved settings", async () => {
  let store = settings([resource({ configured: false, staff_count: null, hours_per_day: null, working_days: [], base_capacity: null })]);
  const api = request((path, init) => {
    if (path === "/capacity/settings" && init.method == null) return Response.json(store);
    const body = JSON.parse(init.body);
    const current = store.resources.find((item) => item.key === "designers");
    const saved = { ...current, ...body, configured: true, base_capacity: "30" };
    store = { ...store, resources: store.resources.map((item) => item.key === "designers" ? saved : item) };
    return Response.json(saved);
  });
  const loaded = await loadCapacitySettings(api);
  const draft = settingsPayload({ staff_count: 3, hours_per_day: "10", working_days: [0, 1, 2], work_center_id: null, note: "  " });
  await saveCapacitySettings(loaded.resources, "designers", draft, api);
  const reloaded = await loadCapacitySettings(api);
  const designers = reloaded.resources.find((item) => item.key === "designers");
  assert.equal(designers.staff_count, 3);
  assert.equal(designers.hours_per_day, "10");
  assert.deepEqual(designers.working_days, [0, 1, 2]);
  assert.equal(designers.note, null);
  assert.equal(designers.base_capacity, "30");
});

test("API validation and server errors stay visible", async () => {
  const item = resource();
  const draft = { staff_count: 5, hours_per_day: "8", working_days: [0], work_center_id: null, note: null };
  await assert.rejects(
    saveCapacitySettings([item], item.key, draft, request(() => Response.json({ detail: [{ msg: "Часы дня больше 24" }] }, { status: 422 }))),
    /Часы дня больше 24/,
  );
  await assert.rejects(
    saveCapacityException([item], item.key, "2026-10-20", { capacity: null, unavailable: true, note: null }, request(() => new Response("down", { status: 502 }))),
    /502/,
  );
});

test("validation follows the live contract", () => {
  const purchase = resource({
    key: "procurement", name: "Закупка", kind: "milestone", unit: "milestone", configured: false,
    staff_count: null, hours_per_day: null, base_capacity: null, editable_fields: [],
  });
  const laser = resource({
    key: "laser", name: "Лазер", kind: "machine", unit: "machine_hours", configured: true,
    staff_count: null, hours_per_day: "8", work_center_id: 21, base_capacity: "8",
    editable_fields: ["work_center_id", "hours_per_day", "working_days", "note"],
  });
  const cutters = resource({ key: "cutters", name: "Общий пул раскройщиков" });
  const poolDraft = { staff_count: 5, hours_per_day: "8", working_days: [], work_center_id: null, note: null };
  assert.match(validateSettings(purchase, poolDraft), /не задаётся/);
  assert.equal(validateSettings(resource(), poolDraft), null);
  assert.match(validateSettings(laser, { ...poolDraft, staff_count: null, hours_per_day: "25", work_center_id: 21 }), /от 0 до 24/);
  assert.match(validateSettings(laser, { ...poolDraft, staff_count: null, work_center_id: null }), /оборудование/);
  assert.match(validateSettings(laser, { ...poolDraft, staff_count: 1, work_center_id: 21 }), /численность не задаётся/);
  assert.match(validateSettings(cutters, { ...poolDraft, staff_count: 3 }), /от 0 до 2/);
  const packing = resource({ key: "packing_team", name: "Бригада упаковки", kind: "team", unit: "item" });
  assert.match(validateSettings(packing, { ...poolDraft, staff_count: 2 }), /от 0 до 1/);
  assert.equal(validateSettings(packing, { ...poolDraft, staff_count: 1 }), null);
  assert.match(validateSettings(resource({ stage_active: false }), poolDraft), /неактивен/);
  assert.match(validateException(laser, "bad", { capacity: null, unavailable: true, note: null }), /дату/);
  assert.match(validateException(purchase, "2026-10-20", { capacity: null, unavailable: true, note: null }), /закупки/);
  assert.match(validateException(laser, "2026-10-20", { capacity: "1", unavailable: true, note: null }), /не заполняют/);
  assert.match(validateException(resource({ configured: false }), "2026-10-20", { capacity: "1", unavailable: false, note: null }), /базовую настройку/);
});

test("capacity client shows 404, 422 and network failures without a local catalog", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/missing")) return Response.json({ detail: "Неизвестный маршрут календаря" }, { status: 404 });
    if (String(url).endsWith("/invalid")) return Response.json({ detail: [{ msg: "value is not a valid decimal" }] }, { status: 422 });
    throw new TypeError("Failed to fetch");
  };
  try {
    await assert.rejects(calendarRequest("/capacity/settings/missing"), /Неизвестный маршрут календаря/);
    await assert.rejects(calendarRequest("/capacity/settings/invalid"), /value is not a valid decimal/);
    await assert.rejects(calendarRequest("/capacity/settings"), /Failed to fetch/);
  } finally {
    globalThis.fetch = original;
  }
});

test("capacity screen reads tech operations and keeps the list layout", () => {
  const source = readFileSync(join(root, "components/production/calendar-capacity-settings.tsx"), "utf8");
  const fields = readFileSync(join(root, "components/settings/tech-operation-capacity-fields.tsx"), "utf8");
  const adapter = readFileSync(join(root, "lib/production/calendar-capacity.ts"), "utf8");
  const proxy = readFileSync(join(root, "app/api/production-calendar/[...path]/route.ts"), "utf8");
  const page = readFileSync(join(root, "app/(workspace)/production/calendar/capacity/page.tsx"), "utf8");
  assert.ok(source.includes("lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]"));
  assert.ok(source.includes("md:hidden"));
  assert.ok(source.includes("hidden overflow-x-auto md:block"));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes('role="status"'));
  assert.ok(source.includes("Мощности ещё не заданы"));
  assert.ok(source.includes("saveCapacityResource"));
  assert.equal(source.includes("getTechOperations"), false);
  assert.ok(page.includes("getTechOperations"));
  assert.ok(fields.includes("includes(index)"));
  assert.equal(source.includes("loadCapacitySettings"), false);
  assert.equal(source.includes("/capacity/rules"), false);
  assert.equal(source.includes("Локальные значения"), false);
  assert.ok(adapter.includes("/capacity/settings"));
  assert.equal(adapter.includes("/capacity/rules"), false);
  assert.equal(adapter.includes("fixture"), false);
  assert.ok(proxy.includes("capacity/settings"));
  assert.ok(page.includes("CalendarCapacitySettings"));
  assert.equal(requiredNames.length, 14);
  assert.equal(adapter.includes("print_prep"), false);
  assert.equal(adapter.includes("cutting_pool"), false);
  assert.equal(source.includes("working_hours"), false);
});
