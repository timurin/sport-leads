/** UI-F live contract: `/capacity/settings` from production-calendar-capacity-pc-03-4a. */

type CapacityRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

export type CapacityUnit = "person_hours" | "machine_hours" | "team_hours" | "milestone";
export type CapacityKind = "pool" | "machine" | "team" | "milestone";
export type CapacityNormSource = "manual" | "confirmed_v0.1" | "technical_card_assembly" | "milestone";

export type CapacityException = {
  date: string;
  capacity: string | null;
  unavailable: boolean;
  note: string | null;
};

export type CapacityNorm = {
  source: CapacityNormSource;
  rates: Record<string, string>;
  required_staff_count: number | null;
};

export type CapacityResource = {
  key: string;
  name: string;
  stage_code: string;
  production_stage_id: number | null;
  stage_name: string | null;
  stage_active: boolean;
  kind: CapacityKind;
  unit: CapacityUnit;
  configured: boolean;
  work_center_id: number | null;
  staff_count: number | null;
  hours_per_day: string | null;
  working_days: number[];
  note: string | null;
  base_capacity: string | null;
  editable_fields: string[];
  norm: CapacityNorm;
  exceptions: CapacityException[];
};

export type CapacityStage = { id: number; name: string; code: string; is_active: boolean };
export type CapacityWorkCenter = {
  id: number;
  name: string;
  code: string | null;
  production_stage_id: number | null;
  is_active: boolean;
};

export type CapacitySettings = {
  resources: CapacityResource[];
  stages: CapacityStage[];
  work_centers: CapacityWorkCenter[];
};

export type CapacitySettingsUpdate = {
  staff_count: number | null;
  hours_per_day: string | null;
  working_days: number[];
  work_center_id: number | null;
  note: string | null;
};

export type CapacityExceptionUpdate = {
  capacity: string | null;
  unavailable: boolean;
  note: string | null;
};

export const CAPACITY_UNIT_LABEL: Record<CapacityUnit, string> = {
  person_hours: "чел.-ч",
  machine_hours: "маш.-ч",
  team_hours: "бригадо-ч",
  milestone: "готовность",
};

const UPDATE_KEYS = ["staff_count", "hours_per_day", "working_days", "work_center_id", "note"] as const;

export function capacitySections(resources: CapacityResource[]): Array<{ section: string; resources: CapacityResource[] }> {
  const sections: Array<{ section: string; resources: CapacityResource[] }> = [];
  for (const item of resources) {
    const section = item.stage_name ?? item.stage_code;
    const current = sections.find((row) => row.section === section);
    if (current) current.resources.push(item);
    else sections.push({ section, resources: [item] });
  }
  return sections;
}

export function settingsPayload(draft: CapacitySettingsUpdate): CapacitySettingsUpdate {
  const hours = draft.hours_per_day?.trim() ?? "";
  return {
    staff_count: draft.staff_count,
    hours_per_day: hours ? hours : null,
    working_days: [...draft.working_days].sort((left, right) => left - right),
    work_center_id: draft.work_center_id,
    note: draft.note?.trim() ? draft.note.trim() : null,
  };
}

function decimalText(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return value;
  throw new Error("Ответ API содержит нечисловую мощность");
}

function parseException(raw: unknown): CapacityException {
  if (!raw || typeof raw !== "object" || !("date" in raw)) throw new Error("Ответ API не содержит исключение");
  const row = raw as CapacityException;
  return {
    date: String(row.date).slice(0, 10),
    capacity: decimalText(row.capacity),
    unavailable: row.unavailable === true,
    note: row.note ?? null,
  };
}

export function parseCapacityResource(raw: unknown): CapacityResource {
  if (!raw || typeof raw !== "object" || !("key" in raw)) throw new Error("Ответ API не содержит настройку ресурса");
  const row = raw as CapacityResource;
  if (!row.norm?.source) throw new Error("Ответ API не содержит норму ресурса");
  return {
    ...row,
    hours_per_day: decimalText(row.hours_per_day),
    base_capacity: decimalText(row.base_capacity),
    working_days: Array.isArray(row.working_days) ? [...row.working_days] : [],
    editable_fields: Array.isArray(row.editable_fields) ? row.editable_fields : [],
    exceptions: Array.isArray(row.exceptions) ? row.exceptions.map(parseException) : [],
    norm: {
      source: row.norm.source,
      required_staff_count: row.norm.required_staff_count ?? null,
      rates: Object.fromEntries(Object.entries(row.norm.rates ?? {}).map(([name, value]) => [name, String(value)])),
    },
  };
}

export function parseCapacitySettings(body: unknown): CapacitySettings {
  if (!body || typeof body !== "object" || !Array.isArray((body as CapacitySettings).resources)) {
    throw new Error("Ответ API не содержит настройки мощностей");
  }
  const raw = body as CapacitySettings;
  return {
    resources: raw.resources.map(parseCapacityResource),
    stages: Array.isArray(raw.stages) ? raw.stages : [],
    work_centers: Array.isArray(raw.work_centers) ? raw.work_centers : [],
  };
}

function decimal(value: string | null): number | null {
  if (value == null || value.trim() === "") return null;
  if (!/^\d+(\.\d{1,4})?$/.test(value.trim())) return Number.NaN;
  return Number(value);
}

function isoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00");
  const local = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  return !Number.isNaN(date.getTime()) && local === value;
}

function staffLimit(item: CapacityResource): number {
  if (item.key === "packing_team") return 1;
  if (item.key === "cutters") return 2;
  return 10000;
}

export function validateSettings(item: CapacityResource, draft: CapacitySettingsUpdate): string | null {
  if (item.kind === "milestone" || item.unit === "milestone" || !item.editable_fields.length) {
    return "Для закупки часовая мощность не задаётся";
  }
  if (!item.stage_active) return "Участок неактивен, настройка не сохраняется";
  if (draft.working_days.some((day) => day < 0 || day > 6) || new Set(draft.working_days).size !== draft.working_days.length) {
    return "Рабочие дни задаются числами от 0 до 6 без повторов";
  }
  const hours = decimal(draft.hours_per_day);
  if (draft.hours_per_day != null && draft.hours_per_day.trim() !== "" && (hours == null || Number.isNaN(hours) || hours > 24)) {
    return "Часы дня должны быть от 0 до 24, не больше 4 знаков после запятой";
  }
  if (item.kind === "machine") {
    if (draft.staff_count != null) return "Для машины численность не задаётся";
    if (draft.work_center_id == null) return "Выберите оборудование участка";
    return null;
  }
  if (draft.work_center_id != null) return "Для этого ресурса оборудование не выбирается";
  if (draft.staff_count != null && (!Number.isInteger(draft.staff_count) || draft.staff_count < 0 || draft.staff_count > staffLimit(item))) {
    return `Численность от 0 до ${staffLimit(item)}`;
  }
  return null;
}

export function validateException(item: CapacityResource, day: string, draft: CapacityExceptionUpdate): string | null {
  if (item.kind === "milestone" || !item.editable_fields.length) return "Для закупки исключение по часам не задаётся";
  if (!item.configured) return "Сначала сохраните базовую настройку ресурса";
  if (!isoDate(day)) return "Укажите корректную дату";
  if (draft.unavailable) return draft.capacity == null || draft.capacity.trim() === "" ? null : "Для недоступного дня часы не заполняют";
  const capacity = decimal(draft.capacity);
  if (capacity == null || Number.isNaN(capacity) || capacity < 0) return "Укажите доступные часы не меньше 0";
  return null;
}

export function replaceResource(resources: CapacityResource[], saved: CapacityResource): CapacityResource[] {
  return resources.map((item) => item.key === saved.key ? saved : item);
}

export function mergeException(resources: CapacityResource[], key: string, saved: CapacityException): CapacityResource[] {
  return resources.map((item) => {
    if (item.key !== key) return item;
    const rest = item.exceptions.filter((row) => row.date !== saved.date);
    return { ...item, exceptions: [...rest, saved].sort((left, right) => left.date.localeCompare(right.date)) };
  });
}

export function removeException(resources: CapacityResource[], key: string, day: string): CapacityResource[] {
  return resources.map((item) => item.key === key
    ? { ...item, exceptions: item.exceptions.filter((row) => row.date !== day) }
    : item);
}

export async function loadCapacitySettings(request: CapacityRequest): Promise<CapacitySettings> {
  return parseCapacitySettings(await request<unknown>("/capacity/settings"));
}

export async function saveCapacitySettings(
  resources: CapacityResource[],
  key: string,
  draft: CapacitySettingsUpdate,
  request: CapacityRequest,
): Promise<CapacityResource[]> {
  const current = resources.find((item) => item.key === key);
  if (!current) throw new Error("Ресурс не найден");
  const payload = settingsPayload(draft);
  const invalid = validateSettings(current, payload);
  if (invalid) throw new Error(invalid);
  const saved = parseCapacityResource(await request<unknown>(`/capacity/settings/${key}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }));
  for (const field of UPDATE_KEYS) {
    if (!(field in saved)) throw new Error("Ответ API не содержит настройку ресурса");
  }
  return replaceResource(resources, saved);
}

export async function saveCapacityException(
  resources: CapacityResource[],
  key: string,
  day: string,
  draft: CapacityExceptionUpdate,
  request: CapacityRequest,
): Promise<CapacityResource[]> {
  const current = resources.find((item) => item.key === key);
  if (!current) throw new Error("Ресурс не найден");
  const payload: CapacityExceptionUpdate = {
    capacity: draft.unavailable ? null : draft.capacity?.trim() ?? null,
    unavailable: draft.unavailable,
    note: draft.note?.trim() ? draft.note.trim() : null,
  };
  const invalid = validateException(current, day, payload);
  if (invalid) throw new Error(invalid);
  const saved = parseException(await request<unknown>(`/capacity/settings/${key}/exceptions/${day}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }));
  return mergeException(resources, key, saved);
}

export async function deleteCapacityException(
  resources: CapacityResource[],
  key: string,
  day: string,
  request: CapacityRequest,
): Promise<CapacityResource[]> {
  await request<void>(`/capacity/settings/${key}/exceptions/${day}`, { method: "DELETE" });
  return removeException(resources, key, day);
}
