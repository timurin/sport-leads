/** Presentation rules for the tech-operation editor and the capacity monitor. */

import {
  CALCULATION_MODE_LABEL,
  CAPACITY_UNIT_LABEL,
  MILESTONE_CAPTION,
  type CalculationMode,
  type CapacityResource,
} from "./tech-operation-capacity.ts";
import type { ProductionDiagnostic } from "./production/readiness-stickers.ts";

export type OperationEditorTab = "main" | "capacity" | "equipment" | "schedule" | "exceptions";

export type ReadinessStatus = "ready" | "needs_setup" | "no_capacity";

export type OperationReadiness = {
  status: ReadinessStatus;
  label: string;
  issues: string[];
};

export type CatalogChip = "all" | "needs_setup" | "no_capacity";

export type EquipmentLoad = {
  work_center_id: number;
  date: string;
  configured_capacity: string | null;
  allocated: string;
  remaining: string | null;
  utilization_percent: string | null;
  capacity_unit?: string | null;
};

export type MonitorRow = {
  key: string;
  name: string;
  stageName: string;
  stageId: number | null;
  workCenterId: number | null;
  workCenterName: string | null;
  available: string | null;
  occupied: string | null;
  remaining: string | null;
  utilization: string | null;
  operationId: number | null;
  overloaded: boolean;
  kind: "work_center" | "resource";
};

const TABS: OperationEditorTab[] = ["main", "capacity", "equipment", "schedule", "exceptions"];

export function calculationModeLabel(mode: CalculationMode): string {
  return CALCULATION_MODE_LABEL[mode];
}

export function calculationModeHint(mode: CalculationMode): string {
  return mode;
}

export function visibleCapacityConcerns(mode: CalculationMode): string[] {
  if (mode === "milestone") return ["explanation"];
  if (mode === "sewing_norm") return ["source", "resource", "unit"];
  if (mode === "cutting_methods") return ["methods", "resource", "unit"];
  if (mode === "explicit_hours") return ["hours", "shifts", "efficiency", "daily"];
  return ["unit", "rate", "hours", "shifts", "efficiency", "daily"];
}

function linkedResources(keys: string[], resources: CapacityResource[]): CapacityResource[] {
  return keys.map((key) => resources.find((resource) => resource.key === key)).filter((resource): resource is CapacityResource => resource != null);
}

function positive(value: string | null): boolean {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}

/** Same CapacityResource fields the scheduler reads: working_days and one hours_per_day. */
export function resourceSchedule(resource: CapacityResource): { workingDays: number[]; hoursPerDay: string | null } {
  const raw = resource.hours_per_day;
  const hoursPerDay = raw != null && raw.trim() !== "" ? raw.trim() : null;
  return { workingDays: resource.working_days, hoursPerDay };
}

export function operationReadiness(
  operation: { production_stage_id: number | null; capacity_resource_keys?: string[]; diagnostics?: ProductionDiagnostic[] },
  resources: CapacityResource[],
): OperationReadiness {
  const keys = operation.capacity_resource_keys ?? [];
  const linked = linkedResources(keys, resources);
  if (operation.diagnostics !== undefined) {
    const issues = operation.diagnostics.filter((item) => item.severity === "error").map((item) => item.message);
    if (issues.length > 0) return { status: "needs_setup", label: "Требует настройки", issues: [...new Set(issues)] };
    const noCapacity = linked.length > 0 && linked.every((resource) => resource.resource_type === "milestone" || resource.calculation_mode === "milestone");
    return noCapacity
      ? { status: "no_capacity", label: "Без расчёта мощности", issues: [] }
      : { status: "ready", label: "Готово к планированию", issues: [] };
  }
  if (linked.length === 0) {
    return { status: "needs_setup", label: "Требует настройки", issues: ["Не выбран ресурс мощности"] };
  }
  if (linked.every((resource) => resource.resource_type === "milestone" || resource.calculation_mode === "milestone")) {
    return { status: "no_capacity", label: "Без расчёта мощности", issues: [] };
  }
  const issues: string[] = [];
  if (operation.production_stage_id == null) issues.push("Не указан цех");
  for (const resource of linked) {
    if (resource.resource_type === "milestone" || resource.calculation_mode === "milestone") continue;
    if (!resource.calculation_mode) issues.push("Не задан способ расчёта");
    if (!resource.capacity_unit) issues.push("Не указана единица мощности");
    const schedule = resourceSchedule(resource);
    if (schedule.workingDays.length === 0) issues.push("Не задан график работы");
    if (schedule.hoursPerDay == null) issues.push("Не указано количество рабочих часов");
    if (resource.resource_type === "machine" && (resource.work_center_id == null || resource.work_center_id <= 0)) {
      issues.push("Не подключено оборудование");
    }
    if ((resource.calculation_mode === "rate" || resource.calculation_mode === "team_rate") && !positive(resource.base_rate)) {
      issues.push("Не указана производительность");
    }
  }
  const unique = [...new Set(issues)];
  if (unique.length > 0) return { status: "needs_setup", label: "Требует настройки", issues: unique };
  return { status: "ready", label: "Готово к планированию", issues: [] };
}

export function operationMode(keys: string[], resources: CapacityResource[]): CalculationMode | null {
  const linked = linkedResources(keys, resources);
  return linked[0]?.calculation_mode ?? null;
}

export function matchesCatalog(
  operation: { production_stage_id: number | null; capacity_resource_keys?: string[]; diagnostics?: ProductionDiagnostic[] },
  resources: CapacityResource[],
  chip: CatalogChip,
  stageId: number | "all",
  mode: CalculationMode | "all",
): boolean {
  const readiness = operationReadiness(operation, resources);
  const lacksCapacity = (operation.capacity_resource_keys ?? []).length === 0 || readiness.status === "no_capacity";
  if (chip === "needs_setup" && readiness.status !== "needs_setup") return false;
  if (chip === "no_capacity" && !lacksCapacity) return false;
  if (stageId !== "all" && operation.production_stage_id !== stageId) return false;
  if (mode !== "all" && operationMode(operation.capacity_resource_keys ?? [], resources) !== mode) return false;
  return true;
}

export function operationSettingsHref(operationId: number, tab: OperationEditorTab = "main"): string {
  const query = new URLSearchParams({ operation: String(operationId) });
  if (tab !== "main") query.set("tab", tab);
  return `/settings/catalogs/tech-operations?${query.toString()}`;
}

export function equipmentCapacityHref(workCenterId: number): string {
  return `/settings/catalogs/work-centers?capacity=${workCenterId}`;
}

export function parseEquipmentCapacityId(value: string | undefined): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function parseOperationDeepLink(operation: string | undefined, tab: string | undefined): {
  operationId: number | null;
  tab: OperationEditorTab;
} {
  const parsed = Number(operation);
  const operationId = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  const selected = TABS.includes(tab as OperationEditorTab) ? tab as OperationEditorTab : "main";
  return { operationId, tab: selected };
}

export function presentDailyCapacity(resource: CapacityResource): string | null {
  if (resource.resource_type === "milestone" || resource.calculation_mode === "milestone") return null;
  const hours = Number(resource.hours_per_day);
  const efficiency = Number(resource.efficiency);
  if (!Number.isFinite(hours) || !Number.isFinite(efficiency)) return null;
  const count = resource.resource_type === "machine" ? 1 : (resource.resource_count ?? 1);
  const time = hours * resource.shifts_per_day * efficiency * count;
  if (resource.capacity_unit === "linear_meter" || resource.capacity_unit === "item") {
    const rate = Number(resource.base_rate);
    if (!Number.isFinite(rate) || rate <= 0) return null;
    const unit = resource.capacity_unit === "linear_meter" ? "м.п." : "шт.";
    return `${formatQuantity(time * rate)} ${unit}`;
  }
  if (resource.capacity_unit === "labor_hour" || resource.capacity_unit === "team_hour" || resource.capacity_unit === "machine_hour") {
    const unit = CAPACITY_UNIT_LABEL[resource.capacity_unit];
    return `${formatQuantity(time)} ${unit}`;
  }
  return null;
}

function formatQuantity(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function localIsoDate(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function periodDates(anchor: string, period: "today" | "week"): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) return [];
  if (period === "today") return [anchor];
  const [year, month, day] = anchor.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = (date.getUTCDay() + 6) % 7;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - weekday);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(monday);
    next.setUTCDate(monday.getUTCDate() + index);
    return next.toISOString().slice(0, 10);
  });
}

export function summarizeLoads(loads: EquipmentLoad[]): {
  available: string | null;
  occupied: string;
  remaining: string | null;
  utilization: string | null;
} | null {
  if (loads.length === 0) return null;
  let occupied = 0;
  let available = 0;
  let knownAvailable = true;
  for (const load of loads) {
    const used = Number(load.allocated);
    if (!Number.isFinite(used) || used < 0) return null;
    occupied += used;
    if (load.configured_capacity == null) {
      knownAvailable = false;
      continue;
    }
    const capacity = Number(load.configured_capacity);
    if (!Number.isFinite(capacity) || capacity < 0) return null;
    available += capacity;
  }
  if (!knownAvailable) {
    return { available: null, occupied: formatQuantity(occupied), remaining: null, utilization: null };
  }
  const remaining = Math.max(0, available - occupied);
  const utilization = available === 0 ? null : formatQuantity((occupied / available) * 100);
  return {
    available: formatQuantity(available),
    occupied: formatQuantity(occupied),
    remaining: formatQuantity(remaining),
    utilization,
  };
}

export function capacityMonitorRows(input: {
  resources: CapacityResource[];
  stages: Array<{ id: number; name: string }>;
  workCenters: Array<{ id: number; name: string }>;
  operations: Array<{ id: number; capacity_resource_keys?: string[] }>;
  loads: EquipmentLoad[];
}): MonitorRow[] {
  return input.resources.map((resource) => {
    const stageName = input.stages.find((stage) => stage.id === resource.production_stage_id)?.name ?? "Без цеха";
    const center = input.workCenters.find((item) => item.id === resource.work_center_id) ?? null;
    const operation = input.operations.find((item) => (item.capacity_resource_keys ?? []).includes(resource.key));
    const ownLoads = center == null ? [] : input.loads.filter((load) => load.work_center_id === center.id);
    const summary = summarizeLoads(ownLoads);
    const machine = resource.resource_type === "machine" && center != null;
    const available = machine ? (summary?.available ?? null) : presentDailyCapacity(resource);
    const occupied = machine ? (summary?.occupied ?? null) : null;
    const remaining = machine ? (summary?.remaining ?? null) : null;
    const utilization = machine ? (summary?.utilization ?? null) : null;
    const overloaded = utilization != null && Number(utilization) > 100;
    return {
      key: resource.key,
      name: machine ? center.name : resource.name,
      stageName,
      stageId: resource.production_stage_id,
      workCenterId: center?.id ?? null,
      workCenterName: center?.name ?? null,
      available,
      occupied,
      remaining,
      utilization,
      operationId: operation?.id ?? null,
      overloaded,
      kind: machine ? "work_center" : "resource",
    };
  });
}

export function milestoneCaption(): string {
  return MILESTONE_CAPTION;
}

export function isBrigadeResource(resource: CapacityResource): boolean {
  return resource.resource_type === "labor" && (
    resource.key === "packing_team" || resource.calculation_mode === "team_rate" || resource.capacity_unit === "team_hour"
  );
}

export function resourceKindLabel(resource: CapacityResource): string {
  if (resource.resource_type === "milestone" || resource.calculation_mode === "milestone") return "Контрольная точка";
  if (resource.resource_type === "machine") return "Оборудование";
  if (isBrigadeResource(resource)) return "Бригада";
  if (resource.resource_type === "labor") return "Персонал";
  return "Производительность";
}

export function baseRateFieldLabel(mode: CalculationMode): string | null {
  if (mode === "rate") return "Производительность в час";
  if (mode === "team_rate") return "Производительность бригады в час";
  return null;
}

export function showsResourceCount(resource: CapacityResource): boolean {
  if (resource.resource_type === "milestone" || resource.calculation_mode === "milestone" || resource.resource_type === "machine") return false;
  return !isBrigadeResource(resource);
}

export function formatEfficiencyPercent(value: string): string | null {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  const percent = Math.round(amount * 1000) / 10;
  const text = (Number.isInteger(percent) ? String(percent) : String(percent)).replace(".", ",");
  return `${text}%`;
}

export function efficiencyPercentInput(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  const percent = Math.round(amount * 10000) / 100;
  return Number.isInteger(percent) ? String(percent) : String(percent);
}

export function efficiencyFromPercent(input: string): string {
  const trimmed = input.trim().replace("%", "").replace(",", ".");
  if (!trimmed) return "";
  const percent = Number(trimmed);
  if (!Number.isFinite(percent)) return "";
  return String(Math.round((percent / 100) * 10000) / 10000);
}

export type CalculationGuide = {
  demand: string;
  capacity: string | null;
  notes: string[];
  warning: string | null;
};

function guideQuantity(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return (Number.isInteger(rounded) ? String(rounded) : String(rounded)).replace(".", ",");
}

function shiftPart(shifts: number): string {
  return shifts > 1 ? ` × ${shifts} смены` : "";
}

function staffCapacityLine(resource: CapacityResource): string | null {
  const hours = Number(resource.hours_per_day);
  const efficiency = Number(resource.efficiency);
  if (!Number.isFinite(hours) || !Number.isFinite(efficiency)) return null;
  const count = resource.resource_count ?? 1;
  const daily = hours * resource.shifts_per_day * efficiency * count;
  return `${count} сотрудников × ${guideQuantity(hours)} ч${shiftPart(resource.shifts_per_day)} × ${formatEfficiencyPercent(resource.efficiency)} = ${guideQuantity(daily)} чел.-ч/день`;
}

function throughputCapacityLine(resource: CapacityResource): string | null {
  const rate = Number(resource.base_rate);
  const hours = Number(resource.hours_per_day);
  const efficiency = Number(resource.efficiency);
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(hours) || !Number.isFinite(efficiency)) return null;
  const unit = resource.capacity_unit === "linear_meter" ? "м.п." : "шт.";
  const daily = rate * hours * resource.shifts_per_day * efficiency;
  return `${guideQuantity(rate)} ${unit}/ч × ${guideQuantity(hours)} ч${shiftPart(resource.shifts_per_day)} × ${formatEfficiencyPercent(resource.efficiency)} = ${guideQuantity(daily)} ${unit}/день`;
}

function machineHourLine(resource: CapacityResource): string | null {
  const hours = Number(resource.hours_per_day);
  const efficiency = Number(resource.efficiency);
  if (!Number.isFinite(hours) || !Number.isFinite(efficiency)) return null;
  const daily = hours * resource.shifts_per_day * efficiency;
  return `${guideQuantity(hours)} ч${shiftPart(resource.shifts_per_day)} × ${formatEfficiencyPercent(resource.efficiency)} = ${guideQuantity(daily)} маш.-ч/день`;
}

export function resourceCalculationGuide(resource: CapacityResource): CalculationGuide {
  if (resource.resource_type === "milestone" || resource.calculation_mode === "milestone") {
    return {
      demand: "Потребность не рассчитывается.",
      capacity: null,
      notes: ["Этап не требует производственной мощности и не занимает время ресурса."],
      warning: null,
    };
  }
  if (resource.resource_type === "machine") {
    return {
      demand: resource.capacity_unit === "linear_meter" ? "Из объёма печати" : resource.capacity_unit === "machine_hour" ? "Из времени работы оборудования" : "Из количества изделий",
      capacity: resource.capacity_unit === "machine_hour" ? machineHourLine(resource) : throughputCapacityLine(resource),
      notes: ["Scheduler резервирует загрузку конкретного оборудования."],
      warning: null,
    };
  }
  if (resource.calculation_mode === "explicit_hours") {
    return {
      demand: "Из отдельной нормы времени на операции.",
      capacity: null,
      notes: ["Основа расчёта и норма времени сохраняются в техоперации на вкладке «Основное»."],
      warning: null,
    };
  }
  if (resource.calculation_mode === "cutting_methods") {
    return {
      demand: "Из количества × способ раскроя",
      capacity: null,
      notes: [
        "Пример. Поштучный раскрой: 20 шт./чел.-ч. Заказ 100 шт. → требуется 5 чел.-ч.",
        "Пример. Раскрой настилом: 40 шт./чел.-ч. Заказ 100 шт. → требуется 2,5 чел.-ч.",
      ],
      warning: null,
    };
  }
  if (isBrigadeResource(resource)) {
    return {
      demand: "Из количества изделий и производительности бригады",
      capacity: throughputCapacityLine(resource),
      notes: ["Норма задана для всей бригады, а не для одного сотрудника."],
      warning: null,
    };
  }
  if (resource.calculation_mode === "sewing_norm") {
    return {
      demand: "Из нормы пошива модели",
      capacity: staffCapacityLine(resource),
      notes: ["Пример: если заказ требует 30 чел.-ч, он займёт примерно 0,67 рабочего дня при полностью свободном ресурсе."],
      warning: null,
    };
  }
  if (resource.calculation_mode === "rate") {
    return {
      demand: resource.capacity_unit === "linear_meter" ? "Из объёма печати" : "Из количества изделий",
      capacity: throughputCapacityLine(resource),
      notes: [],
      warning: null,
    };
  }
  return {
    demand: "Из численности и рабочего времени",
    capacity: staffCapacityLine(resource),
    notes: ["Пример: если заказ требует 30 чел.-ч, он займёт примерно 0,67 рабочего дня при полностью свободном ресурсе."],
    warning: null,
  };
}
