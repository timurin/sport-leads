/** Presentation of the PC-04.4A queue response. Ordering uses stored fields; dates are not planned here. */

import { calendarPathsAfterSchedule, deviationText, type ScheduleDeviation } from "./tech-card-schedule.ts";

export const QUEUE_ACTION_LABEL = "Пересчитать производственный план";
export const QUEUE_PENDING_LABEL = "Пересчитываем...";

export type QueueCardSchedule = {
  technical_card_id: number;
  technical_card_number: string;
  priority: number | null;
  status: "planned" | "blocked";
  persisted?: boolean;
  preserved?: boolean;
  planned_completion_date?: string | null;
  on_time?: boolean | null;
  buffer_days?: number | null;
  delay_days?: number | null;
  steps_count?: number;
  deviations?: ScheduleDeviation[];
};

export type QueueSchedule = {
  status: "planned" | "partial" | "blocked" | "empty";
  total_cards: number;
  planned_cards: number;
  blocked_cards: number;
  deadline_missed_cards: number;
  preserved_cards: number;
  results?: QueueCardSchedule[];
};

export type QueueCardRow = {
  id: number;
  number: string;
  display_number?: string | null;
  order_number?: string | null;
  priority?: number | null;
  shipping_date?: string | null;
  planning_start_date?: string | null;
  plan_locked?: boolean;
  status?: string;
  sales_order_id?: number | null;
  order_group_id?: number | null;
  created_at: string;
};

export function queueSchedulePath(): string {
  return "/production-calendar/schedule";
}

export function queueCalendarRefreshPaths(): string[] {
  return calendarPathsAfterSchedule();
}

export function canRunQueueSchedule(dirtyCount: number): boolean {
  return dirtyCount === 0;
}

export function shouldRefreshCalendar(schedule: Pick<QueueSchedule, "status" | "results">): boolean {
  if (schedule.status === "planned" || schedule.status === "partial") return true;
  return (schedule.results ?? []).some((row) => row.persisted === true);
}

export function priorityPatch(value: string):
  | { ok: true; priority: number | null }
  | { ok: false; message: string } {
  const text = value.trim();
  if (!text) return { ok: true, priority: null };
  if (!/^[1-9]\d*$/.test(text)) {
    return { ok: false, message: "Приоритет — целое число от 1; пустое поле ставит карточку после явных приоритетов" };
  }
  const priority = Number(text);
  return Number.isSafeInteger(priority)
    ? { ok: true, priority }
    : { ok: false, message: "Приоритет — целое число от 1; пустое поле ставит карточку после явных приоритетов" };
}

export function isProductionQueueCard(card: {
  sales_order_id?: number | null;
  order_group_id?: number | null;
  status?: string;
}): boolean {
  return card.sales_order_id == null
    && card.order_group_id != null
    && (card.status === "draft" || card.status === "in_progress");
}

export function compareQueueCards(left: QueueCardRow, right: QueueCardRow): number {
  const rank = (card: QueueCardRow): Array<number | string> => [
    card.priority == null ? 1 : 0,
    card.priority ?? 0,
    card.shipping_date || "9999-12-31",
    card.planning_start_date || "9999-12-31",
    card.created_at,
    card.id,
  ];
  const a = rank(left);
  const b = rank(right);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] < b[index]) return -1;
    if (a[index] > b[index]) return 1;
  }
  return 0;
}

export function readQueueSchedule(body: unknown): QueueSchedule {
  if (!body || typeof body !== "object") throw new Error("Ответ очереди пуст");
  const row = body as QueueSchedule;
  if (row.status !== "planned" && row.status !== "partial" && row.status !== "blocked" && row.status !== "empty") {
    throw new Error("Ответ очереди не содержит статус");
  }
  if ([row.total_cards, row.planned_cards, row.blocked_cards, row.deadline_missed_cards, row.preserved_cards]
    .some((value) => typeof value !== "number")) {
    throw new Error("Ответ очереди не содержит сводку");
  }
  return row;
}

export function queueSummaryText(schedule: QueueSchedule): string {
  return [
    `Всего ${schedule.total_cards}`,
    `спланировано ${schedule.planned_cards}`,
    `blocked ${schedule.blocked_cards}`,
    `риск срока ${schedule.deadline_missed_cards}`,
    `сохранено ${schedule.preserved_cards}`,
  ].join(" · ");
}

export function queueResultStatus(input: {
  planLocked?: boolean;
  result?: Pick<QueueCardSchedule, "status" | "on_time" | "delay_days" | "deviations"> | null;
}): "planned" | "blocked" | "риск срока" | "locked" | "нет расчёта" {
  const result = input.result;
  const locked = input.planLocked === true
    || result?.deviations?.some((item) => item.code === "locked_assignment_conflict") === true;
  if (locked) return "locked";
  if (result?.status === "blocked") return "blocked";
  if (result && (result.on_time === false || (result.delay_days ?? 0) > 0)) return "риск срока";
  if (result?.status === "planned") return "planned";
  return "нет расчёта";
}

export function planningModeLabel(
  mode: "auto" | "manual_adjusted" | "locked" | null | undefined,
  manualLock = false,
): "auto" | "manual_adjusted" | "locked" {
  if (manualLock || mode === "locked") return "locked";
  if (mode === "manual_adjusted") return "manual_adjusted";
  return "auto";
}

export function queueModeCaption(input: {
  planLocked?: boolean;
  preserved?: boolean;
  modes?: Array<"auto" | "manual_adjusted" | "locked" | null | undefined>;
  manualLocks?: boolean[];
}): "auto" | "ручная" | "блок" {
  const labels = (input.modes ?? []).map((mode, index) => planningModeLabel(mode, input.manualLocks?.[index] === true));
  if (input.planLocked || input.preserved || labels.includes("locked")) return "блок";
  if (labels.includes("manual_adjusted")) return "ручная";
  return "auto";
}

export function queueDeviationLines(deviations: ScheduleDeviation[] | undefined): string[] {
  return (deviations ?? []).map((item) => deviationText(item));
}
