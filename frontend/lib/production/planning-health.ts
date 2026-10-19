/** Presents GET planning-health. Overdue, risk, ETA and slack stay on the server. */

import { calendarRequest } from "./calendar.ts";

export type PlanningHealthState = "not_planned" | "actual" | "stale" | "invalid" | "completed";
export type PlanningRiskLevel = "unknown" | "on_time" | "late";
export type PlanAttentionFilter = "all" | "overdue" | "risk" | "replan" | "clear";

export type PlanningHealthSummary = {
  technical_card_id: number;
  planning_date: string;
  planning_state: PlanningHealthState;
  replan_required: boolean;
  eta: string | null;
  shipping_date: string | null;
  slack_days: number | null;
  on_time: boolean | null;
  risk_level: PlanningRiskLevel;
  current_workshop_id: number | null;
  current_workshop_name: string | null;
  route_total_operations: number;
  completed_operations: number;
  in_progress_operations: number;
  pending_operations: number;
  has_overdue_operations: boolean;
  overdue_operation_count: number;
  earliest_overdue_operation: string | null;
  earliest_overdue_snapshot_node_id: number | null;
  earliest_overdue_workshop: string | null;
  earliest_overdue_date: string | null;
  overdue_days: number;
  next_operation: string | null;
  next_snapshot_node_id: number | null;
  next_operation_date: string | null;
  has_planning_issues: boolean;
};

export type OperationPlanningHealth = {
  snapshot_node_id: number;
  operation_name: string;
  workshop_id: number | null;
  workshop_name: string;
  operation_status: string;
  planned_start: string | null;
  planned_end: string | null;
  is_overdue: boolean;
  overdue_days: number;
  is_protected: boolean;
  can_replan: boolean;
  warning_code: string | null;
};

export type PlanningHealth = PlanningHealthSummary & { operations: OperationPlanningHealth[] };
export type ManualPlanningCardHealth = PlanningHealthSummary & { number: string };

export type PlanningHealthBadge = {
  tone: "danger" | "risk" | "replan" | "ok" | "neutral";
  label: string;
};

export type PlanningListIdentity = {
  orderNumber: string | null;
  model: string | null;
  quantity: string | null;
};

export type PlanningHealthFilters = {
  search: string;
  stageId: number | null;
  attention: PlanAttentionFilter;
  shippingDate: string;
};

const STATES = new Set<PlanningHealthState>(["not_planned", "actual", "stale", "invalid", "completed"]);
const RISKS = new Set<PlanningRiskLevel>(["unknown", "on_time", "late"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function asDate(value: unknown): string | null | undefined {
  if (value == null) return null;
  return typeof value === "string" && ISO_DATE.test(value) ? value : undefined;
}

function asInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function asOptionalInt(value: unknown): number | null | undefined {
  if (value == null) return null;
  return asInt(value);
}

function asBool(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asText(value: unknown): string | null | undefined {
  if (value == null) return null;
  return typeof value === "string" ? value : undefined;
}

export function parsePlanningHealthSummary(value: unknown): PlanningHealthSummary | null {
  if (!isRecord(value)) return null;
  const planningState = value.planning_state;
  const risk = value.risk_level;
  const eta = asDate(value.eta);
  const shipping = asDate(value.shipping_date);
  const planningDate = asDate(value.planning_date);
  const earliestDate = asDate(value.earliest_overdue_date);
  const nextDate = asDate(value.next_operation_date);
  const slack = value.slack_days == null ? null : asInt(value.slack_days);
  const cardId = asInt(value.technical_card_id);
  const overdueDays = asInt(value.overdue_days);
  const counts = [
    asInt(value.route_total_operations),
    asInt(value.completed_operations),
    asInt(value.in_progress_operations),
    asInt(value.pending_operations),
    asInt(value.overdue_operation_count),
  ];
  if (
    cardId == null || planningDate == null || overdueDays == null || slack === undefined
    || eta === undefined || shipping === undefined || earliestDate === undefined || nextDate === undefined
    || !STATES.has(planningState as PlanningHealthState) || !RISKS.has(risk as PlanningRiskLevel)
    || counts.some((item) => item == null)
    || asBool(value.replan_required) == null || asBool(value.has_overdue_operations) == null
    || asBool(value.has_planning_issues) == null
    || (value.on_time != null && typeof value.on_time !== "boolean")
    || asOptionalInt(value.current_workshop_id) === undefined
    || asOptionalInt(value.earliest_overdue_snapshot_node_id) === undefined
    || asOptionalInt(value.next_snapshot_node_id) === undefined
    || asText(value.current_workshop_name) === undefined
    || asText(value.earliest_overdue_operation) === undefined
    || asText(value.earliest_overdue_workshop) === undefined
    || asText(value.next_operation) === undefined
  ) return null;
  return {
    technical_card_id: cardId,
    planning_date: planningDate,
    planning_state: planningState as PlanningHealthState,
    replan_required: value.replan_required as boolean,
    eta,
    shipping_date: shipping,
    slack_days: slack,
    on_time: value.on_time == null ? null : value.on_time as boolean,
    risk_level: risk as PlanningRiskLevel,
    current_workshop_id: value.current_workshop_id == null ? null : value.current_workshop_id as number,
    current_workshop_name: value.current_workshop_name == null ? null : value.current_workshop_name as string,
    route_total_operations: counts[0] as number,
    completed_operations: counts[1] as number,
    in_progress_operations: counts[2] as number,
    pending_operations: counts[3] as number,
    has_overdue_operations: value.has_overdue_operations as boolean,
    overdue_operation_count: counts[4] as number,
    earliest_overdue_operation: value.earliest_overdue_operation == null ? null : value.earliest_overdue_operation as string,
    earliest_overdue_snapshot_node_id: value.earliest_overdue_snapshot_node_id == null ? null : value.earliest_overdue_snapshot_node_id as number,
    earliest_overdue_workshop: value.earliest_overdue_workshop == null ? null : value.earliest_overdue_workshop as string,
    earliest_overdue_date: earliestDate,
    overdue_days: overdueDays,
    next_operation: value.next_operation == null ? null : value.next_operation as string,
    next_snapshot_node_id: value.next_snapshot_node_id == null ? null : value.next_snapshot_node_id as number,
    next_operation_date: nextDate,
    has_planning_issues: value.has_planning_issues as boolean,
  };
}

export function parseOperationPlanningHealth(value: unknown): OperationPlanningHealth | null {
  if (!isRecord(value)) return null;
  const id = asInt(value.snapshot_node_id);
  const start = asDate(value.planned_start);
  const end = asDate(value.planned_end);
  const overdueDays = asInt(value.overdue_days);
  const workshopId = asOptionalInt(value.workshop_id);
  if (
    id == null || start === undefined || end === undefined || overdueDays == null || workshopId === undefined
    || typeof value.operation_name !== "string" || typeof value.workshop_name !== "string"
    || typeof value.operation_status !== "string"
    || asBool(value.is_overdue) == null || asBool(value.is_protected) == null || asBool(value.can_replan) == null
    || asText(value.warning_code) === undefined
  ) return null;
  return {
    snapshot_node_id: id,
    operation_name: value.operation_name,
    workshop_id: workshopId,
    workshop_name: value.workshop_name,
    operation_status: value.operation_status,
    planned_start: start,
    planned_end: end,
    is_overdue: value.is_overdue as boolean,
    overdue_days: overdueDays,
    is_protected: value.is_protected as boolean,
    can_replan: value.can_replan as boolean,
    warning_code: value.warning_code == null ? null : value.warning_code as string,
  };
}

export function parsePlanningHealth(value: unknown): PlanningHealth | null {
  const summary = parsePlanningHealthSummary(value);
  if (!summary || !isRecord(value) || !Array.isArray(value.operations)) return null;
  const operations: OperationPlanningHealth[] = [];
  for (const row of value.operations) {
    const operation = parseOperationPlanningHealth(row);
    if (!operation) return null;
    operations.push(operation);
  }
  return { ...summary, operations };
}

export function parseManualPlanningCardList(value: unknown): ManualPlanningCardHealth[] | null {
  if (!Array.isArray(value)) return null;
  const cards: ManualPlanningCardHealth[] = [];
  for (const row of value) {
    const summary = parsePlanningHealthSummary(row);
    if (!summary || !isRecord(row) || typeof row.number !== "string" || !row.number.trim()) return null;
    if ("operations" in row) return null;
    cards.push({ ...summary, number: row.number });
  }
  return cards;
}

export function formatHealthDate(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}.${month}.${year}` : value;
}

export function healthDayLabel(days: number): string {
  const abs = Math.abs(days) % 100;
  const last = abs % 10;
  const word = abs > 10 && abs < 20 ? "дней" : last === 1 ? "день" : last >= 2 && last <= 4 ? "дня" : "дней";
  return `${days} ${word}`;
}

export function planningStateLabel(state: PlanningHealthState): string {
  if (state === "not_planned") return "Не рассчитан";
  if (state === "actual") return "Актуален";
  if (state === "stale") return "Устарел";
  if (state === "invalid") return "Некорректный";
  return "Завершён";
}

export function planningHealthBadge(summary: PlanningHealthSummary, surface: "list" | "card"): PlanningHealthBadge {
  if (summary.has_overdue_operations) {
    return surface === "list"
      ? { tone: "danger", label: `Просрочена на ${healthDayLabel(summary.overdue_days)}` }
      : { tone: "danger", label: `Просрочено операций: ${summary.overdue_operation_count}` };
  }
  if (summary.risk_level === "late") return { tone: "risk", label: "Риск срока" };
  if (summary.replan_required) return { tone: "replan", label: "Требует перепланирования" };
  if (summary.planning_state === "completed") return { tone: "ok", label: "Производство завершено" };
  if (summary.planning_state === "not_planned" || summary.has_planning_issues) return { tone: "neutral", label: "План не рассчитан" };
  return { tone: "ok", label: "План актуален" };
}

export function planningHealthEmpty(attention: PlanAttentionFilter): string {
  if (attention === "overdue") return "Просроченных операций не найдено.";
  if (attention === "risk") return "Техкарт с риском срока нет.";
  if (attention === "replan") return "Нет техкарт, требующих перепланирования.";
  if (attention === "clear") return "Нет техкарт с актуальным планом.";
  return "Нет техкарт для ручного планирования.";
}

export function matchesPlanningAttention(summary: PlanningHealthSummary, attention: PlanAttentionFilter): boolean {
  if (attention === "overdue") return summary.has_overdue_operations;
  if (attention === "risk") return summary.risk_level === "late";
  if (attention === "replan") return summary.replan_required;
  if (attention === "clear") return !summary.has_planning_issues;
  return true;
}

export function planningHealthCounts(cards: readonly PlanningHealthSummary[]): { overdue: number; risk: number; replan: number } {
  return {
    overdue: cards.filter((card) => card.has_overdue_operations).length,
    risk: cards.filter((card) => card.risk_level === "late").length,
    replan: cards.filter((card) => card.replan_required).length,
  };
}

export function planningProgressText(summary: Pick<PlanningHealthSummary, "completed_operations" | "route_total_operations">): string {
  return `${summary.completed_operations} из ${summary.route_total_operations}`;
}

export function planningAttentionLine(summary: PlanningHealthSummary, surface: "list" | "card" = "card"): string | null {
  if (summary.has_overdue_operations) {
    const name = summary.earliest_overdue_operation?.trim() || "операция";
    const count = summary.overdue_operation_count > 1 && surface === "list" ? ` Всего ${summary.overdue_operation_count}.` : "";
    return `Просрочена операция «${name}» на ${healthDayLabel(summary.overdue_days)}.${count}`;
  }
  if (summary.risk_level === "late") return "Риск срока.";
  if (summary.replan_required) return "Требует перепланирования.";
  return null;
}

export function earliestOverdueText(summary: PlanningHealthSummary): string | null {
  if (!summary.has_overdue_operations) return null;
  const name = summary.earliest_overdue_operation?.trim() || "—";
  const workshop = summary.earliest_overdue_workshop?.trim() || "—";
  return `${name} · ${workshop} · ${formatHealthDate(summary.earliest_overdue_date)} · ${healthDayLabel(summary.overdue_days)}`;
}

export function planningHealthSummaryLines(summary: PlanningHealthSummary): string[] {
  const lines = [
    `Состояние: ${planningStateLabel(summary.planning_state)}`,
    `ETA: ${formatHealthDate(summary.eta)}`,
    `Отгрузка: ${formatHealthDate(summary.shipping_date)}`,
    `Запас: ${summary.slack_days == null ? "—" : healthDayLabel(summary.slack_days)}`,
    `Прогресс: ${planningProgressText(summary)}`,
    `Участок: ${summary.current_workshop_name?.trim() || "—"}`,
    `Следующая: ${summary.next_operation?.trim() || "—"}`,
  ];
  if (summary.replan_required) lines.push("Нужно перепланирование");
  const earliest = earliestOverdueText(summary);
  if (summary.has_overdue_operations) lines.push(`Просрочено операций: ${summary.overdue_operation_count}`);
  if (earliest) lines.push(earliest);
  if (summary.risk_level === "late") lines.push("Риск срока");
  else if (summary.risk_level === "on_time") lines.push("В срок");
  return lines;
}

export function sharedHealthFacts(summary: PlanningHealthSummary) {
  return {
    eta: summary.eta,
    shipping_date: summary.shipping_date,
    slack_days: summary.slack_days,
    planning_state: summary.planning_state,
    overdue_operation_count: summary.overdue_operation_count,
    earliest_overdue_operation: summary.earliest_overdue_operation,
    earliest_overdue_date: summary.earliest_overdue_date,
    overdue_days: summary.overdue_days,
    risk_level: summary.risk_level,
    progress: planningProgressText(summary),
  };
}

export function operationHealthStatus(operation: Pick<OperationPlanningHealth, "operation_status" | "is_overdue">): string {
  if (operation.operation_status === "completed") return "Завершена";
  if (operation.operation_status === "in_progress") return "В работе";
  if (operation.operation_status === "skipped") return "Пропущена";
  if (operation.operation_status === "pending" && operation.is_overdue) return "Просрочена";
  if (operation.operation_status === "pending") return "Запланирована";
  return "Закрыто";
}

export function operationPlanLabel(operation: Pick<OperationPlanningHealth, "planned_start" | "planned_end">): string | null {
  if (!operation.planned_start && !operation.planned_end) return null;
  const start = formatHealthDate(operation.planned_start);
  const end = formatHealthDate(operation.planned_end);
  if (!operation.planned_end || operation.planned_start === operation.planned_end) return operation.planned_start ? start : null;
  return `${start}–${end}`;
}

export function operationWarningLabel(code: string | null): string | null {
  if (code === "manual_replan_protected") return "Операция защищена: её нельзя переносить.";
  if (code === "saved_selected_operation_required") return "Для операции нет сохранённого плана.";
  return null;
}

export function planningWorkshopOptions(cards: readonly PlanningHealthSummary[]): { id: number; name: string }[] {
  const names = new Map<number, string>();
  for (const card of cards) {
    if (card.current_workshop_id == null || names.has(card.current_workshop_id)) continue;
    names.set(card.current_workshop_id, card.current_workshop_name?.trim() || "Участок");
  }
  return [...names.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name, "ru"));
}

export function filterPlanningHealth(
  cards: readonly ManualPlanningCardHealth[],
  identities: ReadonlyMap<number, PlanningListIdentity>,
  filters: PlanningHealthFilters,
): ManualPlanningCardHealth[] {
  const search = filters.search.trim().toLocaleLowerCase("ru");
  return cards.filter((card) => {
    if (!matchesPlanningAttention(card, filters.attention)) return false;
    if (filters.stageId != null && card.current_workshop_id !== filters.stageId) return false;
    if (filters.shippingDate && card.shipping_date !== filters.shippingDate) return false;
    if (!search) return true;
    const identity = identities.get(card.technical_card_id);
    const haystack = [card.number, identity?.orderNumber, identity?.model, card.current_workshop_name].join(" ").toLocaleLowerCase("ru");
    return haystack.includes(search);
  });
}

export function planningScheduleText(summary: Pick<PlanningHealthSummary, "eta" | "shipping_date" | "slack_days">): string {
  const slack = summary.slack_days == null ? "—" : healthDayLabel(summary.slack_days);
  return `ETA ${formatHealthDate(summary.eta)} · Отгрузка ${formatHealthDate(summary.shipping_date)} · Запас ${slack}`;
}

export async function fetchManualPlanningCards(signal?: AbortSignal): Promise<ManualPlanningCardHealth[]> {
  const limit = 500;
  const cards: ManualPlanningCardHealth[] = [];
  for (let offset = 0; offset <= 4500; offset += limit) {
    const payload = await calendarRequest<unknown>(`/manual-planning/cards?limit=${limit}&offset=${offset}`, { signal });
    const page = parseManualPlanningCardList(payload);
    if (!page) throw new Error("Сервер вернул неполный список планирования.");
    cards.push(...page);
    if (page.length < limit) return cards;
  }
  return cards;
}

export async function fetchPlanningHealth(cardId: number, signal?: AbortSignal): Promise<PlanningHealth> {
  const response = await fetch(`/api/technical-cards/${cardId}/planning-health`, {
    cache: "no-store",
    credentials: "include",
    signal,
  });
  if (!response.ok) {
    throw new Error(response.status === 404 ? "Техкарта не найдена." : "Не удалось загрузить сводку плана.");
  }
  const parsed = parsePlanningHealth(await response.json());
  if (!parsed) throw new Error("Сервер вернул неполную сводку плана.");
  return parsed;
}
