import type { CalendarAssignment, CalendarBoard } from "./calendar";
import type { CapacityResource, CapacitySettings, CapacityUnit } from "./calendar-capacity";

export type QueueLoadState = "reserve" | "near" | "over" | "unknown";
export type QueueDemand = { unit: CapacityUnit; technical_card_id?: number; quantity?: string };
export type QueueLoadRead = {
  resource_key: string; date: string; unit: CapacityUnit; capacity: string | null;
  known_planned_hours: string; unknown_demand_count: number; load_percent: string | null;
  state: QueueLoadState; reason: string | null; warning_only: true;
};
export type QueueResourceLoad = { resource: CapacityResource; load: QueueLoadRead | null; error: string | null };
export type QueueLoads = { cells: Record<string, QueueResourceLoad[]>; errorCount: number };
export type QueueLoadRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

export const QUEUE_LOAD_LABEL: Record<QueueLoadState, string> = {
  reserve: "Есть резерв", near: "Близко к пределу", over: "Перегрузка", unknown: "Недостаточно данных",
};

export function queueLoadCellKey(stageId: number, date: string): string {
  return `${stageId}:${date}`;
}

/** Supply existing facts, never infer meters, cutting method, machine placement or manual hours. */
export function queueDemands(resource: CapacityResource, assignments: CalendarAssignment[]): QueueDemand[] {
  return assignments.map((assignment) => {
    if (resource.key === "sewers") return { unit: resource.unit, technical_card_id: assignment.technical_card_id };
    if (resource.key === "packing_team") return { unit: resource.unit, quantity: assignment.quantity };
    return { unit: resource.unit };
  });
}

function decimal(value: unknown, nullable: boolean): string | null {
  if (value === null && nullable) return null;
  if ((typeof value !== "string" && typeof value !== "number") || String(value).trim() === "" || !Number.isFinite(Number(value))) {
    throw new Error("API загрузки вернул некорректное числовое значение");
  }
  return String(value);
}

export function parseQueueLoad(raw: unknown, resource: CapacityResource, date: string): QueueLoadRead {
  if (!raw || typeof raw !== "object") throw new Error("API загрузки вернул некорректный ответ");
  const row = raw as QueueLoadRead;
  if (!Object.hasOwn(QUEUE_LOAD_LABEL, row.state) || row.resource_key !== resource.key || row.date !== date || row.unit !== resource.unit ||
      row.warning_only !== true || !Number.isSafeInteger(row.unknown_demand_count) || row.unknown_demand_count < 0) {
    throw new Error("Ответ API загрузки не соответствует ресурсу и дате");
  }
  return { ...row, capacity: decimal(row.capacity, true), known_planned_hours: decimal(row.known_planned_hours, false)!, load_percent: decimal(row.load_percent, true) };
}

export function queueLoadLabel(load: QueueLoadRead): string {
  const percent = load.state !== "unknown" && load.load_percent !== null
    ? ` · ${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(Number(load.load_percent))}%` : "";
  return QUEUE_LOAD_LABEL[load.state] + percent;
}

/** One settings read + <=14 resources x 7 days, regardless of assignment count. Six in flight. */
export async function loadQueueLoads(board: CalendarBoard, days: string[], stageIds: number[], request: QueueLoadRequest,
  signal?: AbortSignal): Promise<QueueLoads> {
  const settings = await request<CapacitySettings>("/capacity/settings", { signal });
  if (!Array.isArray(settings.resources)) throw new Error("API мощностей не вернул список ресурсов");
  const result: QueueLoads = { cells: {}, errorCount: 0 };
  const jobs: Array<{ cell: string; date: string; entry: QueueResourceLoad; assignments: CalendarAssignment[] }> = [];
  for (const stageId of stageIds) {
    const resources = settings.resources.filter((resource) => resource.production_stage_id === stageId);
    for (const date of days) {
      const cell = queueLoadCellKey(stageId, date);
      result.cells[cell] = [];
      const assignments = board.assignments.filter((row) => row.production_stage_id === stageId && row.planned_date === date);
      for (const resource of resources) {
        const entry: QueueResourceLoad = { resource, load: null, error: null };
        result.cells[cell].push(entry);
        jobs.push({ cell, date, entry, assignments });
      }
    }
  }
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      if (signal?.aborted) throw new DOMException("Загрузка отменена", "AbortError");
      const job = jobs[cursor++];
      try {
        if (job.assignments.length > 100) throw new Error("Более 100 назначений за день: текущий API не поддерживает полный расчёт");
        const raw = await request<unknown>("/capacity/load-state", {
          method: "POST", signal, body: JSON.stringify({ resource_key: job.entry.resource.key, date: job.date,
            demands: queueDemands(job.entry.resource, job.assignments) }),
        });
        job.entry.load = parseQueueLoad(raw, job.entry.resource, job.date);
      } catch (error) {
        if (signal?.aborted) throw error;
        job.entry.error = error instanceof Error ? error.message : "Не удалось загрузить индикатор";
        result.errorCount++;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, jobs.length) }, () => worker()));
  return result;
}
