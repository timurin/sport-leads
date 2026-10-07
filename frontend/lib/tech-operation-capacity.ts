/** M:N capacity resources shared by tech operations (PC-03.7A / PC-03.7C). */

export const CAPACITY_RESOURCE_TYPES = ["labor", "machine", "throughput", "milestone"] as const;
export const CAPACITY_UNITS = ["labor_hour", "machine_hour", "team_hour", "item", "linear_meter"] as const;
export const CALCULATION_MODES = ["explicit_hours", "rate", "sewing_norm", "cutting_methods", "team_rate", "milestone"] as const;

export type CapacityResourceType = (typeof CAPACITY_RESOURCE_TYPES)[number];
export type CapacityUnit = (typeof CAPACITY_UNITS)[number];
export type CalculationMode = (typeof CALCULATION_MODES)[number];

export type CapacityException = {
  date: string;
  unavailable: boolean;
  capacity: string | null;
  note: string | null;
};

export type CapacityResource = {
  key: string;
  name: string;
  production_stage_id: number | null;
  work_center_id: number | null;
  resource_type: CapacityResourceType;
  capacity_unit: CapacityUnit | null;
  base_rate: string | null;
  resource_count: number | null;
  hours_per_day: string | null;
  shifts_per_day: number;
  efficiency: string;
  working_days: number[];
  include_in_calendar_load: boolean;
  calculation_mode: CalculationMode;
  note: string | null;
  exceptions: CapacityException[];
};

export const RESOURCE_TYPE_LABEL: Record<CapacityResourceType, string> = {
  labor: "Трудовой",
  machine: "Оборудование",
  throughput: "Производительность",
  milestone: "Веха",
};

export const CAPACITY_UNIT_LABEL: Record<CapacityUnit, string> = {
  labor_hour: "чел.-ч",
  machine_hour: "маш.-ч",
  team_hour: "бриг.-ч",
  item: "шт.",
  linear_meter: "м.п.",
};

export const CALCULATION_MODE_LABEL: Record<CalculationMode, string> = {
  explicit_hours: "Часы",
  rate: "Норма",
  sewing_norm: "Норма пошива",
  cutting_methods: "Методы раскроя",
  team_rate: "Норма бригады",
  milestone: "Веха",
};

const RESOURCE_KEY = /^[A-Za-z0-9_-]{1,64}$/;

export function defaultCapacityResource(key = "", stageId: number | null = null): CapacityResource {
  return {
    key,
    name: "",
    production_stage_id: stageId,
    work_center_id: null,
    resource_type: "labor",
    capacity_unit: "labor_hour",
    base_rate: null,
    resource_count: 1,
    hours_per_day: "8",
    shifts_per_day: 1,
    efficiency: "1",
    working_days: [0, 1, 2, 3, 4],
    include_in_calendar_load: true,
    calculation_mode: "explicit_hours",
    note: null,
    exceptions: [],
  };
}

const MACHINE_UNITS: CapacityUnit[] = ["machine_hour", "linear_meter", "item"];

export function capacityUnitChoices(resource: CapacityResource): CapacityUnit[] {
  if (resource.resource_type === "milestone") return [];
  const units: CapacityUnit[] = resource.resource_type === "machine"
    ? [...MACHINE_UNITS]
    : resource.resource_type === "throughput"
      ? ["item", "linear_meter"]
      : ["labor_hour", "team_hour"];
  if (resource.resource_type === "labor" && (resource.calculation_mode === "cutting_methods" || resource.calculation_mode === "team_rate")) {
    units.push("item");
  }
  if (resource.capacity_unit && !units.includes(resource.capacity_unit)) units.push(resource.capacity_unit);
  return units;
}

export function withResourceType(resource: CapacityResource, resourceType: CapacityResourceType): CapacityResource {
  if (resourceType === "milestone") {
    return {
      ...resource,
      resource_type: "milestone",
      capacity_unit: null,
      base_rate: null,
      resource_count: null,
      hours_per_day: null,
      work_center_id: null,
      shifts_per_day: 1,
      efficiency: "1",
      calculation_mode: "milestone",
    };
  }
  if (resourceType === "machine") {
    const unit = resource.capacity_unit != null && MACHINE_UNITS.includes(resource.capacity_unit)
      ? resource.capacity_unit
      : "machine_hour";
    return {
      ...resource,
      resource_type: "machine",
      capacity_unit: unit,
      resource_count: null,
      calculation_mode: unit === "machine_hour"
        ? (resource.calculation_mode === "rate" ? "rate" : "explicit_hours")
        : "rate",
    };
  }
  if (resourceType === "throughput") {
    const unit = resource.capacity_unit === "linear_meter" ? "linear_meter" : "item";
    return {
      ...resource,
      resource_type: "throughput",
      capacity_unit: unit,
      work_center_id: null,
      calculation_mode: "rate",
    };
  }
  const unit = resource.capacity_unit === "team_hour" || resource.capacity_unit === "item" || resource.capacity_unit === "labor_hour"
    ? resource.capacity_unit
    : "labor_hour";
  const mode = resource.calculation_mode === "milestone" || resource.calculation_mode === "rate"
    ? "explicit_hours"
    : resource.calculation_mode;
  return {
    ...resource,
    resource_type: "labor",
    capacity_unit: unit,
    work_center_id: null,
    calculation_mode: mode === "team_rate" && unit !== "team_hour" && unit !== "item" ? "explicit_hours" : mode,
  };
}

function textOrNull(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return value.trim() || null;
  return null;
}

function intOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function readException(row: unknown): CapacityException | null {
  if (!row || typeof row !== "object") return null;
  const item = row as Record<string, unknown>;
  const date = textOrNull(item.date);
  if (!date) return null;
  return {
    date,
    unavailable: item.unavailable === true,
    capacity: item.unavailable === true ? null : textOrNull(item.capacity),
    note: textOrNull(item.note),
  };
}

export function readCapacityResource(row: unknown): CapacityResource {
  const source = row && typeof row === "object" ? row as Record<string, unknown> : {};
  const resourceType = CAPACITY_RESOURCE_TYPES.includes(source.resource_type as CapacityResourceType)
    ? source.resource_type as CapacityResourceType
    : "labor";
  const unit = CAPACITY_UNITS.includes(source.capacity_unit as CapacityUnit)
    ? source.capacity_unit as CapacityUnit
    : null;
  const mode = CALCULATION_MODES.includes(source.calculation_mode as CalculationMode)
    ? source.calculation_mode as CalculationMode
    : resourceType === "milestone" ? "milestone" : "explicit_hours";
  const days = Array.isArray(source.working_days)
    ? source.working_days.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [0, 1, 2, 3, 4];
  return {
    key: textOrNull(source.key) ?? "",
    name: textOrNull(source.name) ?? "",
    production_stage_id: intOrNull(source.production_stage_id),
    work_center_id: intOrNull(source.work_center_id),
    resource_type: resourceType,
    capacity_unit: resourceType === "milestone" ? null : unit,
    base_rate: textOrNull(source.base_rate),
    resource_count: intOrNull(source.resource_count ?? source.staff_count),
    hours_per_day: textOrNull(source.hours_per_day),
    shifts_per_day: intOrNull(source.shifts_per_day) ?? 1,
    efficiency: textOrNull(source.efficiency) ?? "1",
    working_days: [...new Set(days)].sort((a, b) => a - b),
    include_in_calendar_load: source.include_in_calendar_load !== false,
    calculation_mode: mode,
    note: textOrNull(source.note),
    exceptions: Array.isArray(source.exceptions)
      ? source.exceptions.map(readException).filter((item): item is CapacityException => item != null)
      : [],
  };
}

export function resourceWriteBody(resource: CapacityResource): Record<string, unknown> {
  const normalized = resource.resource_type === "milestone" ? withResourceType(resource, "milestone") : resource;
  return {
    name: normalized.name.trim(),
    production_stage_id: normalized.production_stage_id,
    work_center_id: normalized.resource_type === "machine" ? normalized.work_center_id : null,
    resource_type: normalized.resource_type,
    capacity_unit: normalized.resource_type === "milestone" ? null : normalized.capacity_unit,
    base_rate: normalized.resource_type === "milestone" ? null : textOrNull(normalized.base_rate),
    resource_count: normalized.key === "packing_team"
      ? 1
      : normalized.resource_type === "milestone" || normalized.resource_type === "machine"
        ? null
        : normalized.resource_count,
    hours_per_day: normalized.resource_type === "milestone" ? null : textOrNull(normalized.hours_per_day),
    shifts_per_day: normalized.shifts_per_day,
    efficiency: textOrNull(normalized.efficiency) ?? "1",
    working_days: [...normalized.working_days].sort((a, b) => a - b),
    include_in_calendar_load: normalized.include_in_calendar_load,
    calculation_mode: normalized.calculation_mode,
    note: textOrNull(normalized.note),
  };
}

export function exceptionWriteBody(exception: CapacityException): { capacity: string | null; unavailable: boolean; note: string | null } {
  return {
    capacity: exception.unavailable ? null : textOrNull(exception.capacity),
    unavailable: exception.unavailable,
    note: textOrNull(exception.note),
  };
}

function decimalError(value: string | null, label: string, min: number, max: number): string | null {
  if (value == null || value.trim() === "") return `Укажите ${label}`;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return `${label}: допустимо от ${min} до ${max}`;
  return null;
}

export function validateCapacityResource(resource: CapacityResource): string | null {
  if (!RESOURCE_KEY.test(resource.key)) return "Код ресурса: 1–64 символа, латиница, цифры, _ или -";
  if (!resource.name.trim()) return "Укажите наименование ресурса";
  if (resource.production_stage_id == null || resource.production_stage_id <= 0) return "Укажите цех ресурса";
  const hours = resource.hours_per_day == null || resource.hours_per_day === "" ? null : Number(resource.hours_per_day);
  if (hours != null && (!Number.isFinite(hours) || hours < 0 || hours > 24)) return "Часов в день: от 0 до 24";
  if (!Number.isInteger(resource.shifts_per_day) || resource.shifts_per_day < 1 || resource.shifts_per_day > 24) {
    return "Смен в день: от 1 до 24";
  }
  if (hours != null && hours * resource.shifts_per_day > 24) return "Часы и смены вместе не больше 24 часов";
  const efficiency = Number(resource.efficiency);
  if (!Number.isFinite(efficiency) || efficiency < 0 || efficiency > 1) return "Эффективность: от 0 до 1";
  if (resource.resource_type === "milestone") {
    return resource.calculation_mode === "milestone" ? null : "Для вехи режим расчёта — milestone";
  }
  if (resource.key === "packing_team" && resource.resource_count !== 1) {
    return "Бригада упаковки — один ресурс: производительность указана для всей бригады";
  }
  if (resource.resource_type === "labor") {
    const itemThroughput = resource.capacity_unit === "item"
      && (resource.calculation_mode === "cutting_methods" || resource.calculation_mode === "team_rate");
    if (resource.capacity_unit !== "labor_hour" && resource.capacity_unit !== "team_hour" && !itemThroughput) {
      return "Для трудового ресурса выберите чел.-ч, бриг.-ч или шт. для раскроя и бригады";
    }
    if (resource.work_center_id != null) return "Трудовой ресурс не привязывают к рабочему центру";
    if (resource.calculation_mode === "team_rate") {
      if (resource.capacity_unit !== "team_hour" && resource.capacity_unit !== "item") {
        return "Норма бригады требует шт. или бриг.-ч и базовую норму";
      }
      const teamRate = decimalError(resource.base_rate, "базовую норму", 0.0001, 9999999999);
      if (teamRate) return teamRate;
    }
    if (resource.calculation_mode === "sewing_norm" && resource.capacity_unit !== "labor_hour") {
      return "Норма пошива требует чел.-ч";
    }
    if (resource.calculation_mode === "cutting_methods" && resource.capacity_unit !== "labor_hour" && resource.capacity_unit !== "item") {
      return "Методы раскроя требуют чел.-ч или шт.";
    }
  }
  if (resource.resource_type === "machine") {
    const natural = resource.capacity_unit === "linear_meter" || resource.capacity_unit === "item";
    if (resource.capacity_unit !== "machine_hour" && !natural) return "Для оборудования выберите маш.-ч, м.п. или шт.";
    if (natural && resource.calculation_mode !== "rate") return "Для м.п. и шт. у оборудования режим — норма";
    if (resource.work_center_id == null || resource.work_center_id <= 0) return "Укажите рабочий центр оборудования";
  }
  if (resource.resource_type === "throughput") {
    if (resource.capacity_unit !== "item" && resource.capacity_unit !== "linear_meter") return "Для производительности выберите шт. или м.п.";
    if (resource.calculation_mode !== "rate") return "Производительность считается по норме";
    if (resource.work_center_id != null) return "Производительность не привязывают к рабочему центру";
    const rate = decimalError(resource.base_rate, "базовую норму", 0.0001, 9999999999);
    if (rate) return rate;
  }
  if (resource.calculation_mode === "rate") {
    const rate = decimalError(resource.base_rate, "базовую норму", 0.0001, 9999999999);
    if (rate) return rate;
  }
  return null;
}

export function validateCapacityException(exception: CapacityException): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exception.date)) return "Укажите дату исключения";
  if (exception.unavailable) {
    return exception.capacity == null || exception.capacity === "" ? null : "Для недоступной даты не заполняют мощность";
  }
  return decimalError(exception.capacity, "мощность на дату", 0, 9999999999);
}

export function upsertCapacityException(exceptions: CapacityException[], exception: CapacityException): CapacityException[] {
  const next = exceptions.filter((item) => item.date !== exception.date);
  next.push({
    date: exception.date,
    unavailable: exception.unavailable,
    capacity: exception.unavailable ? null : textOrNull(exception.capacity),
    note: textOrNull(exception.note),
  });
  return next.sort((a, b) => a.date.localeCompare(b.date));
}

export function removeCapacityException(exceptions: CapacityException[], date: string): CapacityException[] {
  return exceptions.filter((item) => item.date !== date);
}

export function toggleWorkingDay(days: number[], day: number): number[] {
  const next = days.includes(day) ? days.filter((item) => item !== day) : [...days, day];
  return next.sort((a, b) => a - b);
}

export function uniqueResourceKeys(keys: string[]): string[] {
  return [...new Set(keys.map((key) => key.trim()).filter(Boolean))];
}

export function linkResource(keys: string[], key: string): string[] {
  return uniqueResourceKeys([...keys, key]);
}

export function unlinkResource(keys: string[], key: string): string[] {
  return uniqueResourceKeys(keys).filter((item) => item !== key);
}

export function resourceLinkCounts(operations: Array<{ capacity_resource_keys?: string[] }>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const operation of operations) {
    for (const key of new Set(operation.capacity_resource_keys ?? [])) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

export function isSharedResource(operations: Array<{ capacity_resource_keys?: string[] }>, key: string): boolean {
  return (resourceLinkCounts(operations).get(key) ?? 0) > 1;
}

function formatQuantity(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function formatResourceRate(resource: CapacityResource): string {
  if (resource.resource_type === "milestone" || resource.calculation_mode === "milestone") return "Milestone";
  const rate = Number(resource.base_rate);
  if ((resource.capacity_unit === "linear_meter" || resource.capacity_unit === "item") && Number.isFinite(rate) && rate > 0) {
    const unit = resource.capacity_unit === "linear_meter" ? "м.п./ч" : "шт./ч";
    const count = resource.resource_count;
    return count != null && count > 1 ? `${formatQuantity(rate)} ${unit} × ${count}` : `${formatQuantity(rate)} ${unit}`;
  }
  const hours = Number(resource.hours_per_day);
  const efficiency = Number(resource.efficiency);
  if (Number.isFinite(hours) && Number.isFinite(efficiency)) {
    const daily = hours * resource.shifts_per_day * efficiency * (resource.resource_count ?? 1);
    if (resource.capacity_unit === "labor_hour" || resource.capacity_unit === "team_hour") {
      return `${formatQuantity(daily)} чел.-ч/день`;
    }
    if (resource.capacity_unit === "machine_hour") return `${formatQuantity(daily)} маш.-ч/день`;
  }
  return "—";
}

export function formatOperationCapacity(keys: string[], resources: CapacityResource[]): string {
  if (keys.length === 0) return "—";
  const byKey = new Map(resources.map((resource) => [resource.key, resource]));
  const detailed = (key: string) => {
    const resource = byKey.get(key);
    if (!resource) return key;
    const rate = formatResourceRate(resource);
    return rate === "—" ? resource.name : `${resource.name} ${rate}`;
  };
  const nameOnly = (key: string) => byKey.get(key)?.name || key;
  if (keys.length === 1) return detailed(keys[0]);
  if (keys.length === 2) return `${detailed(keys[0])} · ${detailed(keys[1])}`;
  return `${detailed(keys[0])} · ${nameOnly(keys[1])} +${keys.length - 2}`;
}
