import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  capacityUnitChoices,
  defaultCapacityResource,
  exceptionWriteBody,
  formatOperationCapacity,
  formatResourceRate,
  isSharedResource,
  linkResource,
  readCapacityResource,
  removeCapacityException,
  resourceWriteBody,
  unlinkResource,
  upsertCapacityException,
  validateCapacityException,
  validateCapacityResource,
  withResourceType,
} from "./tech-operation-capacity.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function resource(patch) {
  return readCapacityResource({ ...defaultCapacityResource("plotters", 3), name: "Плоттеры", ...patch });
}

test("operation column shows one or two resources and then +N", () => {
  const plotters = resource({
    key: "plotters",
    name: "Плоттеры",
    resource_type: "throughput",
    capacity_unit: "linear_meter",
    base_rate: "15",
    resource_count: 4,
    calculation_mode: "rate",
  });
  const pieces = resource({
    key: "cutters",
    name: "Раскройщики",
    capacity_unit: "item",
    base_rate: "20",
    resource_count: 2,
    resource_type: "throughput",
    calculation_mode: "rate",
  });
  const labor = resource({
    key: "sewers",
    name: "Швеи",
    resource_type: "labor",
    capacity_unit: "labor_hour",
    resource_count: 4,
    hours_per_day: "8.5",
    shifts_per_day: 2,
    efficiency: "1",
    calculation_mode: "explicit_hours",
  });
  const milestone = withResourceType(resource({ key: "launch", name: "Запуск" }), "milestone");
  const operator = resource({ key: "print_operator", name: "Оператор", resource_type: "labor", capacity_unit: "labor_hour", resource_count: 1, hours_per_day: "8", shifts_per_day: 1, efficiency: "1" });
  assert.equal(formatResourceRate(plotters), "15 м.п./ч × 4");
  assert.equal(formatResourceRate(pieces), "20 шт./ч × 2");
  assert.equal(formatResourceRate(labor), "68 чел.-ч/день");
  assert.equal(formatResourceRate(milestone), "Milestone");
  assert.equal(formatOperationCapacity(["plotters"], [plotters]), "Плоттеры 15 м.п./ч × 4");
  assert.equal(formatOperationCapacity(["plotters", "sewers"], [plotters, labor]), "Плоттеры 15 м.п./ч × 4 · Швеи 68 чел.-ч/день");
  assert.equal(
    formatOperationCapacity(["plotters", "print_operator", "sewers", "launch"], [plotters, operator, labor, milestone]),
    "Плоттеры 15 м.п./ч × 4 · Оператор +2",
  );
  assert.equal(formatOperationCapacity([], []), "—");
});

test("milestone write omits hourly fields and keeps the resource contract", () => {
  const milestone = withResourceType(defaultCapacityResource("launch", 2), "milestone");
  milestone.name = "Запуск";
  const body = resourceWriteBody(milestone);
  assert.equal(body.resource_type, "milestone");
  assert.equal(body.calculation_mode, "milestone");
  assert.equal(body.capacity_unit, null);
  assert.equal(body.base_rate, null);
  assert.equal(body.resource_count, null);
  assert.equal(body.hours_per_day, null);
  assert.equal(body.work_center_id, null);
  assert.equal(body.capacity_note, undefined);
  assert.equal(body.capacity_exceptions, undefined);
  assert.equal(validateCapacityResource({ ...milestone, name: "Запуск" }), null);
});

test("shared resource stays one record across link, edit and unlink", () => {
  const store = {
    resources: [resource({ key: "print_operator", name: "Оператор печати", resource_count: 1, hours_per_day: "8", shifts_per_day: 1, efficiency: "1", resource_type: "labor", capacity_unit: "labor_hour" })],
    operations: [
      { id: 1, name: "Сублимация", capacity_resource_keys: ["print_operator"] },
      { id: 2, name: "Термоперенос", capacity_resource_keys: ["print_operator"] },
    ],
    deleted: [],
  };
  assert.equal(isSharedResource(store.operations, "print_operator"), true);
  const edited = readCapacityResource({ ...resourceWriteBody({ ...store.resources[0], resource_count: 3 }), key: "print_operator" });
  store.resources = store.resources.map((item) => item.key === edited.key ? { ...item, ...edited, exceptions: item.exceptions } : item);
  for (const operation of store.operations) {
    const linked = operation.capacity_resource_keys.map((key) => store.resources.find((item) => item.key === key));
    assert.equal(linked[0].resource_count, 3);
  }
  const before = store.resources.length;
  store.operations[0].capacity_resource_keys = linkResource(store.operations[0].capacity_resource_keys, "print_operator");
  assert.deepEqual(store.operations[0].capacity_resource_keys, ["print_operator"]);
  assert.equal(store.resources.length, before);
  store.operations[1].capacity_resource_keys = unlinkResource(store.operations[1].capacity_resource_keys, "print_operator");
  assert.equal(store.deleted.length, 0);
  assert.equal(store.resources.some((item) => item.key === "print_operator"), true);
  assert.equal(isSharedResource(store.operations, "print_operator"), false);
});

test("exceptions belong to the resource and replace by date", () => {
  const day = { date: "2026-10-12", unavailable: true, capacity: null, note: "стоп" };
  assert.match(validateCapacityException({ date: "2026-10-12", unavailable: true, capacity: "3", note: null }), /не заполняют/);
  assert.equal(validateCapacityException(day), null);
  const body = exceptionWriteBody(day);
  assert.deepEqual(Object.keys(body).sort(), ["capacity", "note", "unavailable"]);
  const replaced = upsertCapacityException(
    [{ date: "2026-10-12", unavailable: false, capacity: "4", note: null }],
    { date: "2026-10-12", unavailable: false, capacity: "9", note: "простой" },
  );
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].capacity, "9");
  assert.equal(removeCapacityException(replaced, "2026-10-12").length, 0);
  const shared = resource({ key: "print_operator", exceptions: replaced });
  const operations = [
    { capacity_resource_keys: ["print_operator"] },
    { capacity_resource_keys: ["print_operator"] },
  ];
  assert.equal(operations.every((operation) => operation.capacity_resource_keys.includes(shared.key)), true);
  assert.equal(shared.exceptions[0].note, "простой");
});

test("catalog and capacity screen use the same resource API", () => {
  const actions = readFileSync(join(root, "app/(workspace)/settings/catalogs/tech-operations/tech-operation-actions.ts"), "utf8");
  const resourceActions = readFileSync(join(root, "app/(workspace)/settings/catalogs/tech-operations/capacity-resource-actions.ts"), "utf8");
  const workspace = readFileSync(join(root, "components/settings/tech-operations-workspace.tsx"), "utf8");
  const editor = readFileSync(join(root, "components/settings/tech-operation-edit-modal.tsx"), "utf8");
  const drawer = readFileSync(join(root, "components/settings/tech-operation-create-drawer.tsx"), "utf8");
  const screen = readFileSync(join(root, "components/production/calendar-capacity-settings.tsx"), "utf8");
  const fields = readFileSync(join(root, "components/settings/tech-operation-capacity-fields.tsx"), "utf8");
  const materials = readFileSync(join(root, "components/settings/tech-operation-materials-drawer.tsx"), "utf8");
  assert.equal(actions.includes("capacityWriteBody"), false);
  assert.equal(actions.includes("resource_type"), false);
  assert.equal(actions.includes("capacity_note"), false);
  assert.ok(actions.includes("capacity_resource_keys"));
  assert.ok(actions.includes("CAPACITY_PATH"));
  assert.ok(resourceActions.includes("/production-calendar/capacity/resources/"));
  assert.ok(resourceActions.includes("saveCapacityResource"));
  assert.equal(resourceActions.includes("method: \"DELETE\"") && resourceActions.includes("/resources/"), true);
  assert.ok(resourceActions.includes("setOperationCapacityResources"));
  assert.equal(materials.includes("capacity_resource_keys"), false);
  assert.ok(workspace.includes("formatOperationCapacity"));
  assert.ok(workspace.includes('aria-label="Поиск технологических операций"'));
  assert.ok(editor.includes("TechOperationResourcesPanel"));
  assert.ok(editor.includes("Отвязать") || fields.includes("Отвязать"));
  assert.ok(fields.includes("Общий ресурс"));
  assert.ok(drawer.includes("TechOperationResourcesPanel"));
  assert.ok(screen.includes("saveCapacityResource"));
  assert.equal(screen.includes("loadCapacitySettings"), false);
  assert.ok(fields.includes('value.resource_type === "milestone"'));
  assert.ok(fields.includes("Исключения по датам"));
  assert.ok(fields.includes("Недоступно"));
  assert.ok(fields.includes("capacityUnitChoices"));
  assert.ok(fields.includes("Производительность указана для всей бригады"));
  assert.ok(screen.includes("CapacityResourceFields"));
  assert.equal(fields.includes('["machine_hour"] as const'), false);
  const editorSave = screen.slice(screen.indexOf("async function save"));
  assert.ok(editorSave.indexOf("if (!result.ok)") < editorSave.indexOf("setDraft(result.resource)"));
  const panelSave = fields.slice(fields.indexOf("async function saveDraft"));
  assert.ok(panelSave.indexOf("if (!result.ok)") < panelSave.indexOf("setDraft(result.resource)"));
});

test("machine linear meters and items stay valid and are not rewritten to machine hours", () => {
  const plotter = resource({
    key: "plotter_1",
    name: "Плоттер 1",
    resource_type: "machine",
    capacity_unit: "linear_meter",
    calculation_mode: "rate",
    base_rate: "15",
    resource_count: null,
    work_center_id: 4,
  });
  const calender = resource({
    key: "calender",
    name: "Каландр",
    resource_type: "machine",
    capacity_unit: "linear_meter",
    calculation_mode: "rate",
    base_rate: "60",
    resource_count: 1,
    work_center_id: 5,
  });
  const laser = resource({
    key: "laser",
    name: "Лазер",
    resource_type: "machine",
    capacity_unit: "item",
    calculation_mode: "rate",
    base_rate: "100",
    resource_count: null,
    work_center_id: 6,
  });
  assert.equal(validateCapacityResource(plotter), null);
  assert.equal(validateCapacityResource(laser), null);
  assert.deepEqual(capacityUnitChoices(plotter), ["machine_hour", "linear_meter", "item"]);
  assert.equal(formatResourceRate(plotter), "15 м.п./ч");
  assert.equal(formatResourceRate(calender), "60 м.п./ч");
  assert.equal(formatResourceRate(laser), "100 шт./ч");
  assert.equal(withResourceType(plotter, "machine").capacity_unit, "linear_meter");
  assert.equal(resourceWriteBody(plotter).capacity_unit, "linear_meter");
  assert.equal(resourceWriteBody(plotter).resource_count, null);
  const loaded = readCapacityResource({
    key: "plotter_1",
    name: "Плоттер 1",
    resource_type: "machine",
    capacity_unit: "linear_meter",
    calculation_mode: "rate",
    base_rate: "15",
    production_stage_id: 3,
    work_center_id: 4,
  });
  assert.equal(loaded.capacity_unit, "linear_meter");
  assert.equal(resourceWriteBody({ ...loaded, name: "Плоттер 1" }).capacity_unit, "linear_meter");
});

test("labor hours, packing brigade and milestone keep their units", () => {
  const sewers = resource({
    key: "sewers",
    name: "Пошив",
    resource_type: "labor",
    capacity_unit: "labor_hour",
    calculation_mode: "sewing_norm",
    resource_count: 4,
    base_rate: null,
  });
  const operator = resource({
    key: "print_operator",
    name: "Печатник",
    resource_type: "labor",
    capacity_unit: "labor_hour",
    calculation_mode: "explicit_hours",
    resource_count: 1,
    hours_per_day: "8",
    shifts_per_day: 1,
    efficiency: "1",
  });
  const packing = resource({
    key: "packing_team",
    name: "Бригада упаковки",
    resource_type: "labor",
    capacity_unit: "item",
    calculation_mode: "team_rate",
    base_rate: "80",
    resource_count: 1,
  });
  const milestone = withResourceType(resource({ key: "procurement", name: "Закупка" }), "milestone");
  assert.equal(validateCapacityResource(sewers), null);
  assert.equal(validateCapacityResource(operator), null);
  assert.equal(validateCapacityResource(packing), null);
  assert.equal(validateCapacityResource({ ...milestone, name: "Закупка" }), null);
  assert.match(validateCapacityResource({ ...packing, resource_count: 2 }), /всей бригады/);
  assert.equal(resourceWriteBody(packing).resource_count, 1);
  assert.equal(resourceWriteBody(packing).capacity_unit, "item");
  assert.equal(formatResourceRate(packing), "80 шт./ч");
  assert.equal(formatResourceRate(operator), "8 чел.-ч/день");
  assert.equal(formatResourceRate(milestone), "Milestone");
  assert.equal(readCapacityResource(packing).capacity_unit, "item");
  assert.equal(readCapacityResource(operator).capacity_unit, "labor_hour");
});
