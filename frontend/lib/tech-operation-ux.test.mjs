import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { defaultCapacityResource, resourceWriteBody, withResourceType } from "./tech-operation-capacity.ts";
import {
  baseRateFieldLabel,
  calculationModeLabel,
  capacityMonitorRows,
  efficiencyFromPercent,
  equipmentCapacityHref,
  formatEfficiencyPercent,
  isBrigadeResource,
  matchesCatalog,
  milestoneCaption,
  operationReadiness,
  operationSettingsHref,
  parseEquipmentCapacityId,
  parseOperationDeepLink,
  periodDates,
  presentDailyCapacity,
  resourceCalculationGuide,
  resourceKindLabel,
  resourceSchedule,
  showsResourceCount,
  summarizeLoads,
  visibleCapacityConcerns,
} from "./tech-operation-ux.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function resource(patch) {
  return { ...defaultCapacityResource("sewers", 4), name: "Швеи", ...patch };
}

test("saved readiness and catalog filters use backend diagnostics rather than a filled capacity norm", () => {
  const designers = resource({ key: "designers", calculation_mode: "explicit_hours", capacity_unit: "labor_hour", base_rate: "100", hours_per_day: "10" });
  const diagnostic = {
    code: "missing_operator_norm", severity: "error", entity_type: "tech_operation", entity_id: 6,
    entity_name: "Дизайн", field: "demand_rule", field_label: "Правило расчёта потребности",
    message: "Операция «Дизайн»: не заполнено поле «Правило расчёта потребности».", fix_scope: "tech_operation",
  };
  const operation = { production_stage_id: 1, capacity_resource_keys: ["designers"], diagnostics: [diagnostic] };
  assert.deepEqual(operationReadiness(operation, [designers]), {
    status: "needs_setup", label: "Требует настройки", issues: [diagnostic.message],
  });
  assert.equal(matchesCatalog(operation, [designers], "needs_setup", "all", "all"), true);
  const saved = { ...operation, diagnostics: [] };
  assert.equal(operationReadiness(saved, [designers]).status, "ready");
  assert.equal(matchesCatalog(saved, [designers], "needs_setup", "all", "all"), false);
  assert.equal(operationReadiness({ ...operation, diagnostics: [{ ...diagnostic, severity: "warning" }] }, [designers]).status, "ready");
});

test("calculation labels stay business-friendly and milestone is not called a веха", () => {
  assert.equal(calculationModeLabel("sewing_norm"), "По норме пошива модели");
  assert.equal(calculationModeLabel("cutting_methods"), "По способу раскроя");
  assert.equal(calculationModeLabel("rate"), "По производительности");
  assert.equal(calculationModeLabel("team_rate"), "По производительности бригады");
  assert.equal(calculationModeLabel("explicit_hours"), "По заданной норме времени");
  assert.equal(calculationModeLabel("milestone"), "Без расчёта мощности");
  assert.equal(milestoneCaption(), "Контрольная точка — без расчёта мощности");
  assert.equal(visibleCapacityConcerns("sewing_norm").includes("rate"), false);
  assert.deepEqual(visibleCapacityConcerns("milestone"), ["explanation"]);
  assert.ok(visibleCapacityConcerns("cutting_methods").includes("methods"));
  assert.ok(visibleCapacityConcerns("rate").includes("daily"));
});

test("readiness uses linked resources and does not invent missing norms", () => {
  const sewers = resource({ calculation_mode: "sewing_norm", capacity_unit: "labor_hour", hours_per_day: "10", resource_count: 4 });
  const plotter = resource({
    key: "plotter_1", name: "Плоттер", resource_type: "machine", capacity_unit: "linear_meter",
    calculation_mode: "rate", base_rate: "15", hours_per_day: "10", work_center_id: 1, resource_count: null,
  });
  const bare = { production_stage_id: 3, capacity_resource_keys: [] };
  assert.deepEqual(operationReadiness(bare, []).issues, ["Не выбран ресурс мощности"]);
  const ready = operationReadiness({ production_stage_id: 4, capacity_resource_keys: ["sewers"] }, [sewers]);
  assert.equal(ready.status, "ready");
  assert.equal(ready.label, "Готово к планированию");
  assert.equal(ready.issues.includes("Не указано количество рабочих часов"), false);
  assert.equal(operationReadiness({ production_stage_id: null, capacity_resource_keys: ["sewers"] }, [sewers]).issues.includes("Не указан цех"), true);
  const milestone = withResourceType(resource({ key: "launch", name: "Запуск" }), "milestone");
  milestone.name = "Запуск";
  assert.equal(operationReadiness({ production_stage_id: null, capacity_resource_keys: ["launch"] }, [milestone]).status, "no_capacity");
  const weekdaysOnly = { ...sewers, hours_per_day: null, working_days: [0, 1, 2, 3, 4] };
  const missingHours = operationReadiness({ production_stage_id: 4, capacity_resource_keys: ["sewers"] }, [weekdaysOnly]);
  assert.equal(missingHours.issues.includes("Не указано количество рабочих часов"), true);
  assert.equal(missingHours.issues.includes("Не задан график работы"), false);
  assert.equal(resourceSchedule(weekdaysOnly).hoursPerDay, null);
  assert.deepEqual(resourceSchedule(sewers).workingDays, sewers.working_days);
  assert.equal(resourceSchedule(sewers).hoursPerDay, "10");
  const noDays = { ...sewers, working_days: [], hours_per_day: null };
  const several = operationReadiness({ production_stage_id: null, capacity_resource_keys: ["sewers"] }, [noDays]);
  assert.ok(several.issues.length > 1);
  assert.equal(several.issues.includes("Не задан график работы"), true);
  assert.equal(several.issues.includes("Не указано количество рабочих часов"), true);
  const noCenter = { ...plotter, work_center_id: null };
  assert.equal(operationReadiness({ production_stage_id: 3, capacity_resource_keys: ["plotter_1"] }, [noCenter]).issues.includes("Не подключено оборудование"), true);
  const noRate = { ...plotter, base_rate: null };
  assert.equal(operationReadiness({ production_stage_id: 3, capacity_resource_keys: ["plotter_1"] }, [noRate]).issues.includes("Не указана производительность"), true);
  assert.equal(presentDailyCapacity(plotter), "150 м.п.");
  assert.equal(presentDailyCapacity(milestone), null);
});

test("catalog filters and deep link open one operation editor", () => {
  const card = { production_stage_id: 2, capacity_resource_keys: ["cutters"] };
  const cutters = resource({ key: "cutters", calculation_mode: "cutting_methods", capacity_unit: "item", hours_per_day: "8" });
  assert.equal(matchesCatalog(card, [cutters], "all", 2, "cutting_methods"), true);
  assert.equal(matchesCatalog(card, [cutters], "all", 9, "all"), false);
  assert.equal(matchesCatalog({ production_stage_id: 2, capacity_resource_keys: [] }, [], "no_capacity", "all", "all"), true);
  assert.equal(matchesCatalog(card, [cutters], "needs_setup", "all", "all"), false);
  assert.equal(operationSettingsHref(8, "equipment"), "/settings/catalogs/tech-operations?operation=8&tab=equipment");
  assert.deepEqual(parseOperationDeepLink("8", "schedule"), { operationId: 8, tab: "schedule" });
  assert.deepEqual(parseOperationDeepLink("no", "nope"), { operationId: null, tab: "main" });
});

test("monitor shows equipment load and leaves labor occupancy empty", () => {
  const labor = resource({ key: "sewers", name: "Швеи", hours_per_day: "10", shifts_per_day: 1, efficiency: "1", resource_count: 4 });
  const machine = resource({
    key: "plotter_1", name: "Плоттер 1", resource_type: "machine", capacity_unit: "linear_meter",
    calculation_mode: "rate", base_rate: "15", hours_per_day: "10", work_center_id: 4, resource_count: null, production_stage_id: 3,
  });
  const rows = capacityMonitorRows({
    resources: [labor, machine],
    stages: [{ id: 4, name: "Пошив" }, { id: 3, name: "Печать" }],
    workCenters: [{ id: 4, name: "Epson SC-F9200" }],
    operations: [{ id: 2, capacity_resource_keys: ["plotter_1"] }, { id: 3, capacity_resource_keys: ["sewers"] }],
    loads: [{ work_center_id: 4, date: "2026-10-07", configured_capacity: "150", allocated: "40", remaining: "110", utilization_percent: "26.666" }],
  });
  assert.equal(rows.find((row) => row.key === "sewers").occupied, null);
  assert.equal(rows.find((row) => row.key === "plotter_1").name, "Epson SC-F9200");
  assert.equal(rows.find((row) => row.key === "plotter_1").occupied, "40");
  assert.equal(rows.find((row) => row.key === "plotter_1").operationId, 2);
  assert.equal(summarizeLoads([{ work_center_id: 1, date: "2026-10-07", configured_capacity: null, allocated: "5", remaining: null, utilization_percent: null }]).available, null);
  assert.deepEqual(periodDates("2026-10-07", "week"), ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
});

test("operation editor confirms a dirty close and capacity screen keeps catalog settings separate", () => {
  const modal = readFileSync(join(root, "components/settings/tech-operation-edit-modal.tsx"), "utf8");
  const workspace = readFileSync(join(root, "components/settings/tech-operations-workspace.tsx"), "utf8");
  const screen = readFileSync(join(root, "components/production/calendar-capacity-settings.tsx"), "utf8");
  assert.ok(modal.includes("Есть несохранённые изменения"));
  assert.ok(modal.includes("Сохранить"));
  assert.ok(modal.indexOf('id="tech-operation-readiness"') < modal.indexOf('role="tablist"'));
  assert.ok(modal.includes("Ещё"));
  assert.equal(modal.includes("Готовность к планированию"), false);
  for (const label of ["Основное", "Мощность", "Оборудование", "График", "Исключения"]) assert.ok(modal.includes(label));
  assert.ok(workspace.includes("+ Добавить операцию"));
  assert.ok(workspace.includes("Требуют настройки"));
  assert.ok(screen.includes("CalendarCapacityResourceEditor"));
  assert.ok(screen.includes("Сохранить график") === false);
  assert.ok(readFileSync(join(root, "components/production/calendar-capacity-resource-editor.tsx"), "utf8").includes("saveCapacityResource"));
  assert.ok(screen.includes("UNKNOWN_CAPACITY"));
  assert.ok(screen.includes("Повторить"));
  assert.ok(screen.includes('type="date"'));
  assert.equal(modal.includes("Веха"), false);
  assert.equal(screen.includes("Веха"), false);
  const fields = readFileSync(join(root, "components/settings/tech-operation-capacity-fields.tsx"), "utf8");
  const equipment = readFileSync(join(root, "components/settings/work-center-capacity-drawer.tsx"), "utf8");
  assert.equal(fields.includes("saveWorkCenterCapacity"), false);
  assert.equal(fields.includes("Существующий ресурс"), false);
  assert.ok(fields.includes("Привязать ресурс мощности"));
  assert.ok(fields.includes("Выберите ресурс мощности"));
  assert.ok(fields.includes(">Привязать</Button>"));
  assert.ok(fields.includes("resourceSchedule"));
  assert.ok(fields.includes("одно значение для всех рабочих дней"));
  assert.equal(fields.includes('label="Оборудование"'), false);
  assert.equal(fields.includes('focus="machine"') || fields.includes('? "machine"'), false);
  assert.ok(fields.includes("каталоге «Оборудование»"));
  assert.ok(equipment.includes("Мощность оборудования"));
  assert.ok(equipment.includes("saveWorkCenterCapacity"));
  assert.ok(equipment.includes("Рабочих часов в день"));
  assert.ok(equipment.includes("Производительность в час"));
  assert.ok(equipment.includes("Коэффициент эффективности"));
  assert.ok(equipment.includes("Учитывать при планировании"));
  for (const label of ["Тип ресурса", "Базовая норма", "Учитывать в загрузке календаря", "Количество ресурсов", "Режим расчёта", "Единица мощности", "Веха"]) {
    assert.equal(fields.includes(label), false, label);
    assert.equal(equipment.includes(label), false, label);
  }
  assert.ok(fields.includes("Вид ресурса"));
  assert.ok(fields.includes("Как считается"));
  assert.ok(fields.includes("Рабочих часов в день"));
  assert.ok(fields.includes("Количество сотрудников"));
  assert.equal(operationReadiness({ production_stage_id: 1, capacity_resource_keys: ["designers"] }, [
    resource({ key: "designers", calculation_mode: "explicit_hours", capacity_unit: "labor_hour", hours_per_day: "10" }),
  ]).status, "ready");
  assert.equal(equipmentCapacityHref(4), "/settings/catalogs/work-centers?capacity=4");
  assert.equal(parseEquipmentCapacityId("4"), 4);
  assert.equal(parseEquipmentCapacityId("0"), null);
});

test("calculation help uses examples and keeps enum values in the save body", () => {
  const labor = resource({
    key: "sewers",
    resource_type: "labor",
    calculation_mode: "sewing_norm",
    capacity_unit: "labor_hour",
    hours_per_day: "10",
    efficiency: "0.9",
    resource_count: 5,
  });
  assert.equal(resourceKindLabel(labor), "Персонал");
  assert.equal(baseRateFieldLabel("sewing_norm"), null);
  assert.equal(showsResourceCount(labor), true);
  const sewing = resourceCalculationGuide(labor);
  assert.equal(sewing.demand, "Из нормы пошива модели");
  assert.equal(sewing.capacity, "5 сотрудников × 10 ч × 90% = 45 чел.-ч/день");
  assert.ok(sewing.notes.some((note) => note.includes("0,67")));

  const brigade = resource({
    key: "packing_team",
    resource_type: "labor",
    calculation_mode: "team_rate",
    capacity_unit: "item",
    base_rate: "80",
    hours_per_day: "10",
    efficiency: "1",
    resource_count: 1,
  });
  assert.equal(isBrigadeResource(brigade), true);
  assert.equal(resourceKindLabel(brigade), "Бригада");
  assert.equal(showsResourceCount(brigade), false);
  assert.equal(baseRateFieldLabel("team_rate"), "Производительность бригады в час");
  const brigadeGuide = resourceCalculationGuide(brigade);
  assert.equal(brigadeGuide.capacity, "80 шт./ч × 10 ч × 100% = 800 шт./день");
  assert.ok(brigadeGuide.notes.some((note) => note.includes("всей бригады")));

  const machine = resource({
    key: "plotter_1",
    resource_type: "machine",
    capacity_unit: "linear_meter",
    calculation_mode: "rate",
    base_rate: "20",
    hours_per_day: "10",
    efficiency: "0.9",
    resource_count: null,
    work_center_id: 1,
  });
  assert.equal(resourceKindLabel(machine), "Оборудование");
  assert.equal(showsResourceCount(machine), false);
  assert.equal(resourceCalculationGuide(machine).capacity, "20 м.п./ч × 10 ч × 90% = 180 м.п./день");
  assert.ok(resourceCalculationGuide(machine).notes.some((note) => note.includes("оборудования")));

  const cutting = resourceCalculationGuide(resource({
    key: "cutters",
    calculation_mode: "cutting_methods",
    capacity_unit: "item",
    resource_type: "labor",
  }));
  assert.equal(baseRateFieldLabel("cutting_methods"), null);
  assert.equal(cutting.demand, "Из количества × способ раскроя");
  assert.ok(cutting.notes.some((note) => note.startsWith("Пример") && note.includes("20 шт.")));
  assert.ok(cutting.notes.some((note) => note.includes("2,5")));

  const timed = resourceCalculationGuide(resource({
    calculation_mode: "explicit_hours",
    capacity_unit: "labor_hour",
    resource_type: "labor",
    hours_per_day: "8",
    efficiency: "1",
  }));
  assert.equal(timed.capacity, null);
  assert.equal(timed.warning, null);
  assert.ok(timed.notes.some((note) => note.includes("Основное")));
  assert.equal(baseRateFieldLabel("explicit_hours"), null);

  const milestone = withResourceType(resource({ key: "launch", name: "Запуск" }), "milestone");
  const milestoneGuide = resourceCalculationGuide(milestone);
  assert.equal(resourceKindLabel(milestone), "Контрольная точка");
  assert.equal(showsResourceCount(milestone), false);
  assert.equal(baseRateFieldLabel("milestone"), null);
  assert.equal(milestoneGuide.capacity, null);
  assert.ok(milestoneGuide.notes.some((note) => note.includes("не занимает время ресурса")));

  assert.equal(formatEfficiencyPercent("1"), "100%");
  assert.equal(formatEfficiencyPercent("0.90"), "90%");
  assert.equal(formatEfficiencyPercent("0.85"), "85%");
  assert.equal(efficiencyFromPercent("90"), "0.9");
  assert.equal(efficiencyFromPercent("100"), "1");
  assert.equal(efficiencyFromPercent("85"), "0.85");

  const body = resourceWriteBody({ ...labor, efficiency: efficiencyFromPercent("90") });
  assert.equal(body.resource_type, "labor");
  assert.equal(body.calculation_mode, "sewing_norm");
  assert.equal(body.capacity_unit, "labor_hour");
  assert.equal(body.efficiency, "0.9");
  assert.equal(body.hours_per_day, "10");
  const brigadeBody = resourceWriteBody(brigade);
  assert.equal(brigadeBody.resource_type, "labor");
  assert.equal(brigadeBody.calculation_mode, "team_rate");
  assert.equal(brigadeBody.resource_count, 1);
});
