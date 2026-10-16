/** Presentation of the PC-04.3A schedule response. Dates and counts stay backend-owned. */

export const SCHEDULE_PENDING_LABEL = "Рассчитываем...";
export const SCHEDULE_ACTION_LABEL = "Пересчитать план";

export type ScheduleDeviation = {
  code: string;
  reason: string;
  routing_stage_line_id?: number | null;
  resource_key?: string | null;
};

export type ScheduledStep = {
  routing_stage_line_id: number;
  production_stage_id: number;
  planned_start_date: string;
  planned_end_date: string;
  preserved?: boolean;
  assignment_id?: number | null;
};

export type ProductionSchedule = {
  technical_card_id: number;
  status: "planned" | "blocked";
  persisted?: boolean;
  planning_from: string;
  horizon_end: string;
  planned_completion_date?: string | null;
  on_time?: boolean | null;
  buffer_days?: number | null;
  delay_days?: number | null;
  steps?: ScheduledStep[];
  deviations?: ScheduleDeviation[];
};

const DEVIATION_TITLES: Record<string, string> = {
  readiness_not_complete: "Карточка не готова к расчёту",
  demand_calculation_missing: "Не хватает данных для спроса",
  manual_required: "Нужен ручной ввод",
  capacity_missing: "Нет мощности",
  no_available_capacity: "Нет свободной мощности",
  capacity_unit_mismatch: "Единицы мощности не совпадают",
  locked_assignment_conflict: "План или шаг заблокирован",
  deadline_missed: "Срок отгрузки не выдержан",
};

export function schedulePath(cardId: number): string {
  return `/technical-cards/${cardId}/schedule`;
}

export function calendarPathsAfterSchedule(): string[] {
  return [
    "/production/calendar",
    "/production/calendar/planning",
    "/production/calendar/capacity",
  ];
}

export function planningWriteBody(input: {
  planningStartDate: string;
  shippingDate: string;
  priority: string;
  planLocked: boolean;
}):
  | {
      ok: true;
      body: {
        planning_start_date: string | null;
        shipping_date: string | null;
        priority: number | null;
        plan_locked: boolean;
      };
    }
  | { ok: false; message: string } {
  const planningStartDate = dateOrNull(input.planningStartDate);
  if (planningStartDate === undefined) {
    return { ok: false, message: "Дата начала плана должна быть в формате ГГГГ-ММ-ДД" };
  }
  const shippingDate = dateOrNull(input.shippingDate);
  if (shippingDate === undefined) {
    return { ok: false, message: "Дата отгрузки должна быть в формате ГГГГ-ММ-ДД" };
  }
  const priority = priorityOrNull(input.priority);
  if (priority === undefined) {
    return { ok: false, message: "Приоритет — целое число от 1; пустое поле очищает приоритет" };
  }
  return {
    ok: true,
    body: {
      planning_start_date: planningStartDate,
      shipping_date: shippingDate,
      priority,
      plan_locked: input.planLocked,
    },
  };
}

function dateOrNull(value: string): string | null | undefined {
  const text = value.trim();
  if (!text) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined;
}

function priorityOrNull(value: string): number | null | undefined {
  const text = value.trim();
  if (!text) return null;
  if (!/^[1-9]\d*$/.test(text)) return undefined;
  const priority = Number(text);
  return Number.isSafeInteger(priority) ? priority : undefined;
}

export function readProductionSchedule(body: unknown): ProductionSchedule {
  if (!body || typeof body !== "object") throw new Error("Ответ планировщика пуст");
  const row = body as ProductionSchedule;
  if (row.status !== "planned" && row.status !== "blocked") {
    throw new Error("Ответ планировщика не содержит статус");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.planning_from) || !/^\d{4}-\d{2}-\d{2}$/.test(row.horizon_end)) {
    throw new Error("Ответ планировщика не содержит горизонт");
  }
  return row;
}

export function deadlineStatusText(schedule: Pick<ProductionSchedule, "on_time" | "buffer_days" | "delay_days">): string | null {
  if (schedule.delay_days != null && schedule.delay_days > 0) {
    return `опоздание ${schedule.delay_days} дней`;
  }
  if (schedule.on_time === true && schedule.buffer_days === 0) return "в срок";
  if (schedule.on_time === true && schedule.buffer_days != null && schedule.buffer_days > 0) {
    return `запас ${schedule.buffer_days} дней`;
  }
  return null;
}

export function deviationText(deviation: Pick<ScheduleDeviation, "code" | "reason">): string {
  const reason = deviation.reason.trim();
  if (reason === "route_requires_review_before_planning") return "Маршрут техкарты требует проверки перед планированием производства.";
  const title = DEVIATION_TITLES[deviation.code];
  if (!title) return reason || deviation.code;
  return reason ? `${title}: ${reason}` : title;
}

export function formatPlanDay(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${match[3]}.${match[2]}`;
}

export function formatPlanSpan(start: string, end: string): string {
  if (start === end) return formatPlanDay(start);
  return `${formatPlanDay(start)}–${formatPlanDay(end)}`;
}

export function autoStepCount(steps: ScheduledStep[] | undefined): number {
  return (steps ?? []).filter((step) => step.preserved !== true).length;
}

export function scheduleStepRows(
  steps: ScheduledStep[] | undefined,
  stageLabels: ReadonlyMap<number, string>,
): { operation: string; span: string; mode: "auto" | "locked" }[] {
  return (steps ?? []).map((step) => ({
    operation: stageLabels.get(step.production_stage_id) || `Этап ${step.production_stage_id}`,
    span: formatPlanSpan(step.planned_start_date, step.planned_end_date),
    mode: step.preserved === true ? "locked" : "auto",
  }));
}
