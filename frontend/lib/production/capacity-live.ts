/** Live capacity page: backend day-load for equipment, explicit unknown for labor. */

import {
  CAPACITY_UNIT_LABEL,
  removeCapacityException,
  upsertCapacityException,
  type CapacityException,
  type CapacityResource,
  type CapacityUnit,
} from "../tech-operation-capacity.ts";
import { periodDates, type EquipmentLoad } from "../tech-operation-ux.ts";

export const UNKNOWN_CAPACITY = "Неизвестно";
export const NOT_APPLICABLE_CAPACITY = "Без расчёта";

export type CapacitySetupFilter = "all" | "configured" | "unconfigured";
export type CapacityKindFilter = "all" | "work_center" | "resource";

export type LiveCapacityRow = {
  key: string;
  resourceKey: string | null;
  name: string;
  resourceName: string | null;
  stageId: number | null;
  stageName: string;
  workCenterId: number | null;
  workCenterName: string | null;
  operationId: number | null;
  kind: "work_center" | "resource";
  unitLabel: string | null;
  configured: boolean;
  statusLabel: string;
  availableLabel: string;
  occupiedLabel: string;
  remainingLabel: string;
  utilizationLabel: string;
  overloaded: boolean;
};

type StageRef = { id: number; name: string };
type CenterRef = { id: number; name: string; production_stage_id?: number | null };
type OperationRef = { id: number; capacity_resource_keys?: string[] };

export function capacityLoadDates(date: string): string[] {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? [date] : [];
}

export function capacityWeekDates(date: string): string[] {
  return periodDates(date, "week");
}

export function weekdayMonday(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(utc.getTime()) || utc.toISOString().slice(0, 10) !== date) return null;
  return (utc.getUTCDay() + 6) % 7;
}

export function exceptionOn(exceptions: CapacityException[], date: string): CapacityException | null {
  return exceptions.find((item) => item.date === date) ?? null;
}

export function unitLabel(unit: string | null | undefined): string | null {
  if (!unit) return null;
  if (unit in CAPACITY_UNIT_LABEL) return CAPACITY_UNIT_LABEL[unit as CapacityUnit];
  return null;
}

export function resourceConfigured(resource: CapacityResource): boolean {
  if (resource.resource_type === "milestone" || resource.calculation_mode === "milestone") return true;
  if (resource.resource_type === "machine" && (resource.work_center_id == null || resource.work_center_id <= 0)) return false;
  if (resource.working_days.length === 0) return false;
  return resource.hours_per_day != null && resource.hours_per_day.trim() !== "";
}

export function formatCapacityAmount(value: string): string {
  const trimmed = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) return trimmed;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount)) return trimmed;
  const rounded = Math.round(amount * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function withUnit(value: string, unit: string | null): string {
  const text = formatCapacityAmount(value);
  return unit ? `${text} ${unit}` : text;
}

function equipmentMetrics(load: EquipmentLoad | undefined, unit: string | null): Pick<LiveCapacityRow, "availableLabel" | "occupiedLabel" | "remainingLabel" | "utilizationLabel" | "overloaded"> {
  if (!load) {
    return {
      availableLabel: UNKNOWN_CAPACITY,
      occupiedLabel: UNKNOWN_CAPACITY,
      remainingLabel: UNKNOWN_CAPACITY,
      utilizationLabel: UNKNOWN_CAPACITY,
      overloaded: false,
    };
  }
  const availableKnown = load.configured_capacity != null && load.configured_capacity.trim() !== "";
  const remainingKnown = load.remaining != null && load.remaining.trim() !== "";
  const utilizationKnown = load.utilization_percent != null && load.utilization_percent.trim() !== "";
  const utilization = utilizationKnown ? Number(load.utilization_percent) : Number.NaN;
  return {
    availableLabel: availableKnown ? withUnit(load.configured_capacity as string, unit) : UNKNOWN_CAPACITY,
    occupiedLabel: withUnit(load.allocated, unit),
    remainingLabel: remainingKnown ? withUnit(load.remaining as string, unit) : UNKNOWN_CAPACITY,
    utilizationLabel: utilizationKnown ? `${formatCapacityAmount(load.utilization_percent as string)}%` : UNKNOWN_CAPACITY,
    overloaded: Number.isFinite(utilization) && utilization > 100,
  };
}

function statusLabel(resource: CapacityResource | null, configured: boolean, date: string): string {
  if (!configured || resource == null) return "Не настроено";
  if (resource.resource_type === "milestone" || resource.calculation_mode === "milestone") return "Без расчёта мощности";
  const exception = exceptionOn(resource.exceptions, date);
  if (exception?.unavailable) return "Недоступен";
  const weekday = weekdayMonday(date);
  if (weekday != null && !resource.working_days.includes(weekday) && exception == null) return "Нерабочий день";
  return "Настроено";
}

function laborMetrics(resource: CapacityResource): Pick<LiveCapacityRow, "availableLabel" | "occupiedLabel" | "remainingLabel" | "utilizationLabel" | "overloaded"> {
  if (resource.resource_type === "milestone" || resource.calculation_mode === "milestone") {
    return {
      availableLabel: NOT_APPLICABLE_CAPACITY,
      occupiedLabel: NOT_APPLICABLE_CAPACITY,
      remainingLabel: NOT_APPLICABLE_CAPACITY,
      utilizationLabel: NOT_APPLICABLE_CAPACITY,
      overloaded: false,
    };
  }
  return {
    availableLabel: UNKNOWN_CAPACITY,
    occupiedLabel: UNKNOWN_CAPACITY,
    remainingLabel: UNKNOWN_CAPACITY,
    utilizationLabel: UNKNOWN_CAPACITY,
    overloaded: false,
  };
}

export function liveCapacityRows(input: {
  resources: CapacityResource[];
  stages: StageRef[];
  workCenters: CenterRef[];
  operations: OperationRef[];
  loads: EquipmentLoad[];
  date: string;
}): LiveCapacityRow[] {
  const boundCenters = new Set(input.resources.map((resource) => resource.work_center_id).filter((id): id is number => id != null));
  const resourceRows = input.resources.map((resource) => {
    const center = input.workCenters.find((item) => item.id === resource.work_center_id) ?? null;
    const stageId = resource.production_stage_id;
    const stageName = input.stages.find((stage) => stage.id === stageId)?.name ?? "Без цеха";
    const operation = input.operations.find((item) => (item.capacity_resource_keys ?? []).includes(resource.key));
    const machine = resource.resource_type === "machine" && center != null;
    const load = machine ? input.loads.find((item) => item.work_center_id === center.id && item.date === input.date) : undefined;
    const unit = unitLabel(load?.capacity_unit ?? resource.capacity_unit);
    const metrics = machine ? equipmentMetrics(load, unit) : laborMetrics(resource);
    return {
      key: resource.key,
      resourceKey: resource.key,
      name: machine ? center.name : resource.name,
      resourceName: resource.name,
      stageId,
      stageName,
      workCenterId: center?.id ?? null,
      workCenterName: center?.name ?? null,
      operationId: operation?.id ?? null,
      kind: machine ? "work_center" as const : "resource" as const,
      unitLabel: resource.resource_type === "milestone" ? null : unit,
      configured: resourceConfigured(resource),
      statusLabel: statusLabel(resource, resourceConfigured(resource), input.date),
      ...metrics,
    };
  });
  const missingCenters = input.workCenters.filter((center) => !boundCenters.has(center.id)).map((center) => ({
    key: `work-center:${center.id}`,
    resourceKey: null,
    name: center.name,
    resourceName: null,
    stageId: center.production_stage_id ?? null,
    stageName: input.stages.find((stage) => stage.id === center.production_stage_id)?.name ?? "Без цеха",
    workCenterId: center.id,
    workCenterName: center.name,
    operationId: null,
    kind: "work_center" as const,
    unitLabel: null,
    configured: false,
    statusLabel: "Не настроено",
    availableLabel: UNKNOWN_CAPACITY,
    occupiedLabel: UNKNOWN_CAPACITY,
    remainingLabel: UNKNOWN_CAPACITY,
    utilizationLabel: UNKNOWN_CAPACITY,
    overloaded: false,
  }));
  return [...resourceRows, ...missingCenters];
}

export function filterCapacityRows(
  rows: LiveCapacityRow[],
  filter: { stageId: number | "all"; kind: CapacityKindFilter; setup: CapacitySetupFilter; overloadOnly: boolean },
): LiveCapacityRow[] {
  return rows.filter((row) => {
    if (filter.stageId !== "all" && row.stageId !== filter.stageId) return false;
    if (filter.kind !== "all" && row.kind !== filter.kind) return false;
    if (filter.setup === "configured" && !row.configured) return false;
    if (filter.setup === "unconfigured" && row.configured) return false;
    if (filter.overloadOnly && !row.overloaded) return false;
    return true;
  });
}

export function resourcesAfterSave(
  resources: CapacityResource[],
  result: { ok: true; resource: CapacityResource } | { ok: false; message: string },
): { resources: CapacityResource[]; error: string } {
  if (!result.ok) return { resources, error: result.message };
  const exists = resources.some((item) => item.key === result.resource.key);
  return {
    resources: exists
      ? resources.map((item) => item.key === result.resource.key ? result.resource : item)
      : [...resources, result.resource],
    error: "",
  };
}

export function resourceAfterException(
  resource: CapacityResource,
  result: { ok: true; exception: CapacityException } | { ok: false; message: string },
): { resource: CapacityResource; error: string } {
  if (!result.ok) return { resource, error: result.message };
  return {
    resource: { ...resource, exceptions: upsertCapacityException(resource.exceptions, result.exception) },
    error: "",
  };
}

export function resourceAfterExceptionRemoval(
  resource: CapacityResource,
  result: { ok: true; date: string } | { ok: false; message: string },
): { resource: CapacityResource; error: string } {
  if (!result.ok) return { resource, error: result.message };
  return { resource: { ...resource, exceptions: removeCapacityException(resource.exceptions, result.date) }, error: "" };
}
