/** Groups the editable planning board by technical card. No date arithmetic for downstream moves. */

export type PlanningAssignment = {
  id: number;
  technical_card_id: number;
  technical_card_number: string;
  order_number: string;
  nomenclature_name: string | null;
  quantity: string;
  production_stage_id: number;
  production_stage_name: string;
  planned_date: string;
  position: number;
  note: string | null;
  updated_at?: string | null;
  snapshot_node_id?: number | null;
  operation_name?: string | null;
  operation_status?: string | null;
  operation_state?: string | null;
  production_state?: {
    lifecycle_status?: string | null;
    current_workshop_id?: number | null;
    current_workshop_name?: string | null;
    planning_state?: string | null;
  } | null;
};

export type PlanningStageResult = {
  id: number;
  stage_order: number;
  stage_label: string;
  operation_name?: string | null;
  status: string;
  production_stage_id?: number | null;
};

export type PlanningCardFacts = {
  productModelName?: string | null;
  shippingDate?: string | null;
  stageResults?: PlanningStageResult[];
};

export type PlanningSummary = {
  planned_completion_date?: string | null;
  shipping_date?: string | null;
  on_time?: boolean | null;
  buffer_days?: number | null;
  delay_days?: number | null;
  replan_required?: boolean;
  planning_state?: string | null;
};

export type PlanningCard = {
  technicalCardId: number;
  orderNumber: string;
  cardNumber: string;
  model: string;
  quantity: string;
  currentWorkshopId: number | null;
  currentWorkshopName: string;
  planningState: string;
  needsReplan: boolean;
  shippingDate: string | null;
  completedSteps: number | null;
  totalSteps: number | null;
  assignments: PlanningAssignment[];
};

export type PlanningRouteStep = {
  key: string;
  operation: string;
  stage: string;
  planDate: string | null;
  status: string;
  marker: "done" | "active" | "future" | "skipped";
  locked: boolean;
  assignmentId: number | null;
};

export type PlanAttentionFilter = "all" | "overdue" | "risk" | "replan" | "clear";

export type PlanningFilters = {
  search: string;
  stageId: number | null;
  attention: PlanAttentionFilter;
  shippingDate: string;
};

export type PlanningBadge = {
  tone: "danger" | "risk" | "replan" | "ok" | "neutral";
  label: string;
  detail: string | null;
};

const CLOSED_CARD = new Set(["completed", "cancelled"]);
const HEX_TOKEN = /^[a-f0-9]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ReplanMode = "single" | "downstream";

export type ReplanChange = {
  snapshot_node_id: number;
  operation_name: string;
  old_start: string;
  new_start: string;
  reason: string;
};

export type ReplanNotice = { message: string };

export type ReplanPreview = {
  technical_card_id: number;
  snapshot_node_id: number;
  target_date: string;
  mode: ReplanMode;
  revision: string;
  preview_fingerprint: string;
  apply_allowed: boolean;
  old_selected_start: string | null;
  new_selected_start: string | null;
  selected_operation: ReplanChange | null;
  affected_assignments: ReplanChange[];
  old_eta: string | null;
  new_eta: string | null;
  shipping_date: string | null;
  old_slack: number | null;
  new_slack: number | null;
  risk_before: string;
  risk_after: string;
  capacity_warnings: ReplanNotice[];
  dependency_warnings: ReplanNotice[];
  blockers: ReplanNotice[];
};

export const REPLAN_CHANGED = "План был изменён после предпросмотра. Выполните предпросмотр ещё раз.";
export const REPLAN_PROTECTED = "Операцию уже нельзя переносить: работа начата или завершена.";
export const REPLAN_DEPENDENCY = "Выбранная дата нарушает последовательность маршрута.";
export const REPLAN_CAPACITY = "На выбранную дату недостаточно мощности.";
export const REPLAN_DOWNSTREAM_HINT = "Попробуйте режим «Эту и последующие».";
export const FACT_STEP_LABEL = "Фактическая операция — перенос недоступен";

const REPLAN_CONFLICTS: Record<string, string> = {
  manual_replan_changed: REPLAN_CHANGED,
  manual_replan_protected: REPLAN_PROTECTED,
  manual_replan_dependency: REPLAN_DEPENDENCY,
  manual_replan_capacity: REPLAN_CAPACITY,
};

export function addIsoDays(iso: string, days: number): string {
  const date = new Date(iso + "T12:00:00");
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function groupPlanningCards(
  assignments: readonly PlanningAssignment[],
  facts: ReadonlyMap<number, PlanningCardFacts> = new Map(),
): PlanningCard[] {
  const groups = new Map<number, PlanningAssignment[]>();
  for (const assignment of assignments) {
    const lifecycle = assignment.production_state?.lifecycle_status;
    if (lifecycle && CLOSED_CARD.has(lifecycle)) continue;
    const rows = groups.get(assignment.technical_card_id) ?? [];
    rows.push(assignment);
    groups.set(assignment.technical_card_id, rows);
  }
  return [...groups.entries()].map(([technicalCardId, rows]) => {
    const first = [...rows].sort((left, right) => left.id - right.id)[0];
    const fact = facts.get(technicalCardId);
    const state = first.production_state;
    const stages = [...(fact?.stageResults ?? [])].sort((left, right) => left.stage_order - right.stage_order);
    const completedSteps = stages.length ? stages.filter((item) => item.status === "completed").length : null;
    return {
      technicalCardId,
      orderNumber: first.order_number,
      cardNumber: first.technical_card_number,
      model: fact?.productModelName?.trim() || first.nomenclature_name?.trim() || "Изделие",
      quantity: first.quantity,
      currentWorkshopId: state?.current_workshop_id ?? null,
      currentWorkshopName: state?.current_workshop_name?.trim() || "Участок не назначен",
      planningState: state?.planning_state ?? "unknown",
      needsReplan: state?.planning_state === "stale" || state?.planning_state === "invalid",
      shippingDate: fact?.shippingDate ?? null,
      completedSteps,
      totalSteps: stages.length ? stages.length : null,
      assignments: [...rows].sort((left, right) => left.planned_date.localeCompare(right.planned_date) || left.position - right.position || left.id - right.id),
    };
  }).sort((left, right) => left.orderNumber.localeCompare(right.orderNumber, "ru") || left.cardNumber.localeCompare(right.cardNumber, "ru"));
}

export function filterPlanningCards(cards: readonly PlanningCard[], filters: PlanningFilters): PlanningCard[] {
  const search = filters.search.trim().toLocaleLowerCase("ru");
  return cards.filter((card) => {
    if (filters.attention === "replan" && !card.needsReplan) return false;
    if (filters.attention === "clear" && (card.needsReplan || card.planningState !== "planned")) return false;
    if (filters.attention === "overdue" || filters.attention === "risk") return false;
    if (filters.stageId != null && card.currentWorkshopId !== filters.stageId) return false;
    if (filters.shippingDate && card.shippingDate !== filters.shippingDate) return false;
    if (!search) return true;
    const haystack = [card.orderNumber, card.cardNumber, card.model, card.currentWorkshopName].join(" ").toLocaleLowerCase("ru");
    return haystack.includes(search);
  });
}

export function buildPlanningRoute(
  stages: readonly PlanningStageResult[],
  assignments: readonly PlanningAssignment[],
): PlanningRouteStep[] {
  return [...stages].sort((left, right) => left.stage_order - right.stage_order).map((stage) => {
    const assignment = assignments.find((item) => item.snapshot_node_id === stage.id) ?? null;
    const status = stage.status;
    const future = status === "pending" && assignment?.operation_state === "future";
    const current = status === "pending" && assignment?.operation_state === "current";
    const marker = status === "completed" ? "done" : status === "in_progress" || current ? "active" : status === "skipped" ? "skipped" : "future";
    return {
      key: String(stage.id),
      operation: stage.operation_name?.trim() || stage.stage_label,
      stage: stage.stage_label,
      planDate: assignment?.planned_date ?? null,
      status,
      marker,
      locked: !future,
      assignmentId: future ? assignment.id : null,
    };
  });
}

export function routeMarker(marker: PlanningRouteStep["marker"]): string {
  if (marker === "done") return "✓";
  if (marker === "active") return "●";
  if (marker === "skipped") return "—";
  return "○";
}

export function planningRiskLabel(card: Pick<PlanningCard, "planningState" | "needsReplan">, summary: PlanningSummary | null): string {
  if (card.needsReplan || summary?.replan_required) return "Нужен пересчёт";
  if (summary?.on_time === false) return summary.delay_days != null ? `Риск ${summary.delay_days} дн.` : "Риск срока";
  if (summary?.on_time === true) return summary.buffer_days != null ? `Запас ${summary.buffer_days} дн.` : "В срок";
  if (card.planningState === "planned") return "План сохранён";
  if (card.planningState === "partial") return "План неполный";
  if (card.planningState === "unplanned") return "Нет плана";
  return "Риск неизвестен";
}

export function planningProgressLabel(card: Pick<PlanningCard, "completedSteps" | "totalSteps">): string {
  if (card.completedSteps == null || card.totalSteps == null) return "Маршрут откроется в карточке";
  return `${card.completedSteps} из ${card.totalSteps} завершено`;
}

export function planningProgressShort(card: Pick<PlanningCard, "completedSteps" | "totalSteps">): string {
  if (card.completedSteps == null || card.totalSteps == null) return "Маршрут откроется в карточке";
  return `${card.completedSteps} из ${card.totalSteps}`;
}

export function planningQuantityLabel(quantity: string): string {
  const value = quantity.trim();
  if (!/^\d+(\.\d+)?$/.test(value)) return `${value} шт.`;
  const normalized = value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return `${normalized} шт.`;
}

export function planningScheduleLine(shipping: string | null, eta: string | null): string {
  return `ETA ${eta ? formatPlanDate(eta) : "—"} · Отгрузка ${shipping ? formatPlanDate(shipping) : "—"}`;
}

export function planningReplanCount(cards: readonly { needsReplan: boolean }[]): number {
  return cards.filter((card) => card.needsReplan).length;
}

export function planningEmptyLabel(attention: PlanAttentionFilter): string {
  if (attention === "overdue") return "Просроченных операций не найдено.";
  if (attention === "risk") return "Техкарт с риском срока нет.";
  if (attention === "replan") return "Нет техкарт, требующих перепланирования.";
  if (attention === "clear") return "Нет техкарт с актуальным планом.";
  return "Нет техкарт для ручного планирования.";
}

export function planningBadges(
  card: Pick<PlanningCard, "needsReplan" | "planningState">,
  summary: PlanningSummary | null,
): PlanningBadge[] {
  const replan = card.needsReplan || summary?.replan_required === true;
  if (summary?.on_time === false) {
    const eta = summary.planned_completion_date ? formatPlanDate(summary.planned_completion_date) : "—";
    const shipping = summary.shipping_date ? formatPlanDate(summary.shipping_date) : "—";
    return [{ tone: "risk", label: "Риск срока", detail: `ETA ${eta} · Отгрузка ${shipping}` }];
  }
  if (replan) return [{ tone: "replan", label: "Требует перепланирования", detail: null }];
  if (summary?.on_time === true) return [{ tone: "ok", label: "План актуален", detail: null }];
  if (card.planningState === "planned") return [{ tone: "neutral", label: "План сохранён", detail: null }];
  if (card.planningState === "partial") return [{ tone: "neutral", label: "План неполный", detail: null }];
  if (card.planningState === "unplanned") return [{ tone: "neutral", label: "Нет плана", detail: null }];
  return [{ tone: "neutral", label: "Риск неизвестен", detail: null }];
}

export function planningManagerLines(summary: PlanningSummary | null): string[] {
  if (!summary) return [];
  return [
    `ETA: ${summary.planned_completion_date ? formatPlanDate(summary.planned_completion_date) : "—"}`,
    `Отгрузка: ${summary.shipping_date ? formatPlanDate(summary.shipping_date) : "—"}`,
    `Запас: ${formatDayCount(summary.buffer_days ?? null)}`,
  ];
}

export function routeStateLabel(status: string): string {
  if (status === "completed") return "Завершена";
  if (status === "in_progress") return "В работе";
  if (status === "skipped") return "Пропущена";
  if (status === "pending") return "Запланирована";
  return "Закрыто";
}

function formatDayCount(days: number | null): string {
  if (days == null) return "—";
  const abs = Math.abs(days);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  const word = mod10 === 1 && mod100 !== 11 ? "день" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "дня" : "дней";
  return `${days} ${word}`;
}

export function replanPreviewBody(input: {
  technicalCardId: number;
  snapshotNodeId: number;
  targetDate: string;
  mode: ReplanMode;
}) {
  return {
    technical_card_id: input.technicalCardId,
    snapshot_node_id: input.snapshotNodeId,
    target_date: input.targetDate,
    mode: input.mode,
  };
}

export function replanApplyBody(preview: Pick<ReplanPreview, "revision" | "preview_fingerprint">, request: ReturnType<typeof replanPreviewBody>) {
  return { ...request, revision: preview.revision, preview_fingerprint: preview.preview_fingerprint };
}

export function canApplyReplan(preview: ReplanPreview | null, form: {
  snapshotNodeId: number;
  targetDate: string;
  mode: ReplanMode;
}): boolean {
  if (!preview?.apply_allowed) return false;
  if (!HEX_TOKEN.test(preview.revision) || !HEX_TOKEN.test(preview.preview_fingerprint)) return false;
  return preview.snapshot_node_id === form.snapshotNodeId
    && preview.target_date === form.targetDate
    && preview.mode === form.mode;
}

export function formatPlanDate(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}.${month}.${year}` : value;
}

export function replanRiskLabel(value: string): string {
  if (value === "on_time") return "В срок";
  if (value === "late") return "Риск срока";
  if (value === "unknown") return "Неизвестно";
  return value.trim() || "Неизвестно";
}

export function replanSlackLabel(value: number | null): string {
  return value == null ? "—" : `${value} дн.`;
}

export function replanSelectedLine(preview: ReplanPreview, fallbackName: string): string {
  const selected = preview.selected_operation;
  if (selected) return `${selected.operation_name}: ${formatPlanDate(selected.old_start)} → ${formatPlanDate(selected.new_start)}`;
  if (preview.old_selected_start && preview.new_selected_start) {
    return `${fallbackName}: ${formatPlanDate(preview.old_selected_start)} → ${formatPlanDate(preview.new_selected_start)}`;
  }
  return "Новая дата не рассчитана.";
}

export function replanDownstreamLines(preview: ReplanPreview): string[] {
  const selectedId = preview.selected_operation?.snapshot_node_id ?? preview.snapshot_node_id;
  return preview.affected_assignments
    .filter((item) => item.snapshot_node_id !== selectedId)
    .map((item) => `${item.operation_name} ${formatPlanDate(item.old_start)} → ${formatPlanDate(item.new_start)}`);
}

export function replanConflictMessage(code: string | null, backendMessage: string | null): string {
  if (code && REPLAN_CONFLICTS[code]) return REPLAN_CONFLICTS[code];
  if (code === "manual_replan_blocked") return backendMessage?.trim() || "Перенос сейчас нельзя выполнить.";
  return backendMessage?.trim() || "Не удалось перенести операцию.";
}

export function readReplanConflict(body: unknown, headerCode: string | null): { code: string | null; stale: boolean; message: string } {
  const detail = body && typeof body === "object" && "detail" in body ? (body as { detail?: unknown }).detail : null;
  let backendMessage: string | null = null;
  let diagnosticCode: string | null = null;
  if (typeof detail === "string") backendMessage = detail;
  else if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const row = detail as { message?: unknown; diagnostic?: unknown };
    if (typeof row.message === "string") backendMessage = row.message;
    const diagnostic = row.diagnostic;
    if (diagnostic && typeof diagnostic === "object" && !Array.isArray(diagnostic)) {
      const code = (diagnostic as { code?: unknown }).code;
      const message = (diagnostic as { message?: unknown }).message;
      if (typeof code === "string") diagnosticCode = code;
      if (!backendMessage && typeof message === "string") backendMessage = message;
    }
  }
  const code = headerCode?.trim() || diagnosticCode;
  return { code, stale: code === "manual_replan_changed", message: replanConflictMessage(code, backendMessage) };
}

function optionalDate(value: unknown): string | null | undefined {
  if (value == null) return null;
  return typeof value === "string" && ISO_DATE.test(value) ? value : undefined;
}

function optionalSlack(value: unknown): number | null | undefined {
  if (value == null) return null;
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function readChange(value: unknown): ReplanChange | null | undefined {
  if (value == null) return null;
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const oldStart = optionalDate(row.old_start);
  const newStart = optionalDate(row.new_start);
  if (typeof row.snapshot_node_id !== "number" || typeof row.operation_name !== "string" || !oldStart || !newStart) return undefined;
  return {
    snapshot_node_id: row.snapshot_node_id,
    operation_name: row.operation_name,
    old_start: oldStart,
    new_start: newStart,
    reason: typeof row.reason === "string" ? row.reason : "",
  };
}

function readNotices(value: unknown): ReplanNotice[] | undefined {
  if (value == null) return [];
  if (!Array.isArray(value)) return undefined;
  const notices: ReplanNotice[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return undefined;
    const message = (item as { message?: unknown }).message;
    if (typeof message !== "string" || !message.trim()) continue;
    notices.push({ message: message.trim() });
  }
  return notices;
}

export function readReplanPreview(body: unknown): ReplanPreview | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  const mode = row.mode === "single" || row.mode === "downstream" ? row.mode : null;
  const target = optionalDate(row.target_date);
  const oldSelected = optionalDate(row.old_selected_start);
  const newSelected = optionalDate(row.new_selected_start);
  const oldEta = optionalDate(row.old_eta);
  const newEta = optionalDate(row.new_eta);
  const shipping = optionalDate(row.shipping_date);
  const oldSlack = optionalSlack(row.old_slack);
  const newSlack = optionalSlack(row.new_slack);
  const selected = readChange(row.selected_operation ?? null);
  const capacity = readNotices(row.capacity_warnings);
  const dependency = readNotices(row.dependency_warnings);
  const blockers = readNotices(row.blockers);
  if (!mode || !target || oldSelected === undefined || newSelected === undefined || oldEta === undefined || newEta === undefined || shipping === undefined) return null;
  if (oldSlack === undefined || newSlack === undefined || selected === undefined || !capacity || !dependency || !blockers) return null;
  if (typeof row.technical_card_id !== "number" || typeof row.snapshot_node_id !== "number") return null;
  if (typeof row.revision !== "string" || !HEX_TOKEN.test(row.revision)) return null;
  if (typeof row.preview_fingerprint !== "string" || (row.preview_fingerprint !== "" && !HEX_TOKEN.test(row.preview_fingerprint))) return null;
  if (!Array.isArray(row.affected_assignments)) return null;
  const affected: ReplanChange[] = [];
  for (const item of row.affected_assignments) {
    const change = readChange(item);
    if (!change) return null;
    affected.push(change);
  }
  return {
    technical_card_id: row.technical_card_id,
    snapshot_node_id: row.snapshot_node_id,
    target_date: target,
    mode,
    revision: row.revision,
    preview_fingerprint: row.preview_fingerprint,
    apply_allowed: row.apply_allowed === true,
    old_selected_start: oldSelected,
    new_selected_start: newSelected,
    selected_operation: selected,
    affected_assignments: affected,
    old_eta: oldEta,
    new_eta: newEta,
    shipping_date: shipping,
    old_slack: oldSlack,
    new_slack: newSlack,
    risk_before: typeof row.risk_before === "string" ? row.risk_before : "unknown",
    risk_after: typeof row.risk_after === "string" ? row.risk_after : "unknown",
    capacity_warnings: capacity,
    dependency_warnings: dependency,
    blockers,
  };
}

export class ManualReplanRequestError extends Error {
  readonly code: string | null;
  readonly stale: boolean;

  constructor(message: string, code: string | null, stale: boolean) {
    super(message);
    this.code = code;
    this.stale = stale;
  }
}

export async function postManualReplan(kind: "preview" | "apply", body: unknown, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch("/api/production-calendar/manual-planning/" + kind, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = null; }
  }
  if (!response.ok) {
    const conflict = readReplanConflict(payload, response.headers.get("X-Diagnostic-Code"));
    const message = response.status === 401 ? "Нужен вход в свою учётную запись."
      : response.status === 403 ? "Недостаточно прав, чтобы менять план."
      : response.status === 404 ? "Техкарта не найдена."
      : response.status === 422 ? "Проверьте операцию, дату и режим."
      : conflict.message;
    throw new ManualReplanRequestError(message, conflict.code, conflict.stale);
  }
  return payload;
}
