/** Server waiting-queue contract (PC-05.6C). Order is never invented on the client. */

import { productionQuantityLabel } from "./tech-card-display.ts";

export const WORKSHOP_QUEUE_STALE_MESSAGE =
  "Очередь уже изменилась. Обновите данные и повторите изменение.";

export const WORKSHOP_QUEUE_APPLY_SUCCESS =
  "Очередь сохранена. Плановые даты обновятся в календаре.";

const MANAGER_MESSAGES: Record<string, string> = {
  queue_item_not_waiting: "В очереди можно менять порядок только ожидающих работ. Обновите список.",
  queue_cross_workshop_reorder: "Можно менять порядок работ только одного участка.",
  queue_contains_protected_fact: "Начатые, завершённые или закреплённые работы менять нельзя.",
  queue_replan_failed: "Не удалось безопасно пересчитать план. Проверьте причины и повторите предпросмотр.",
  workshop_queue_changed: WORKSHOP_QUEUE_STALE_MESSAGE,
};

export type WorkshopQueueItem = {
  technicalCardId: number;
  number: string;
  snapshotNodeId: number;
  workshopId: number;
  workshopName: string;
  operationName: string;
  position: number;
  priority: number | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  eta: string | null;
  shippingDate: string | null;
  risk: string;
  status: string;
  protected: boolean;
  readOnly: boolean;
};

export type WorkshopQueueRow = WorkshopQueueItem & {
  model: string;
  quantity: string;
};

export type WorkshopQueueSection = {
  workshopId: number;
  revision: string;
  items: WorkshopQueueItem[];
};

export type WorkshopQueueChangeView = {
  snapshotNodeId: number;
  technicalCardId: number;
  oldPosition: number;
  newPosition: number;
  oldPlannedStart: string | null;
  newPlannedStart: string | null;
  oldPlannedEnd: string | null;
  newPlannedEnd: string | null;
  oldEta: string | null;
  newEta: string | null;
  oldRisk: string;
  newRisk: string;
  downstreamSnapshotNodeIds: number[];
};

export type WorkshopQueuePreviewView = {
  workshopId: number;
  revision: string;
  fingerprint: string;
  canApply: boolean;
  changes: WorkshopQueueChangeView[];
  warnings: unknown[];
  blockers: unknown[];
};

export type WorkshopQueueConflict = {
  code: string | null;
  message: string;
  stale: boolean;
  diagnostic: Record<string, unknown> | null;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function dateText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.slice(0, 10) : null;
}

function whole(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function readItem(value: unknown, workshopId: number): WorkshopQueueItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const technicalCardId = whole(row.technical_card_id);
  const snapshotNodeId = whole(row.snapshot_node_id);
  const position = whole(row.queue_position);
  const number = text(row.technical_card_number);
  const itemWorkshop = whole(row.workshop_id);
  if (technicalCardId == null || snapshotNodeId == null || position == null || !number || itemWorkshop !== workshopId) {
    return null;
  }
  return {
    technicalCardId,
    number,
    snapshotNodeId,
    workshopId,
    workshopName: text(row.workshop_name) ?? "Участок",
    operationName: text(row.operation_name) ?? "—",
    position,
    priority: whole(row.priority),
    plannedStart: dateText(row.planned_start),
    plannedEnd: dateText(row.planned_end),
    eta: dateText(row.eta),
    shippingDate: dateText(row.shipping_date),
    risk: text(row.risk) ?? "unknown",
    status: text(row.status) ?? "waiting",
    protected: row.protected === true,
    readOnly: row.read_only === true,
  };
}

export function readWorkshopQueue(body: unknown): WorkshopQueueSection | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  const workshopId = whole(row.workshop_id);
  const revision = text(row.revision);
  if (workshopId == null || revision == null || revision.length !== 64 || !Array.isArray(row.items)) return null;
  const items: WorkshopQueueItem[] = [];
  for (const item of row.items) {
    const parsed = readItem(item, workshopId);
    if (!parsed) return null;
    items.push(parsed);
  }
  return { workshopId, revision, items };
}

function readChange(value: unknown): WorkshopQueueChangeView | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const snapshotNodeId = whole(row.snapshot_node_id);
  const technicalCardId = whole(row.technical_card_id);
  const oldPosition = whole(row.old_position);
  const newPosition = whole(row.new_position);
  if (snapshotNodeId == null || technicalCardId == null || oldPosition == null || newPosition == null) return null;
  const downstream = Array.isArray(row.downstream_snapshot_node_ids)
    ? row.downstream_snapshot_node_ids.flatMap((id) => {
      const parsed = whole(id);
      return parsed == null ? [] : [parsed];
    })
    : [];
  return {
    snapshotNodeId,
    technicalCardId,
    oldPosition,
    newPosition,
    oldPlannedStart: dateText(row.old_planned_start),
    newPlannedStart: dateText(row.new_planned_start),
    oldPlannedEnd: dateText(row.old_planned_end),
    newPlannedEnd: dateText(row.new_planned_end),
    oldEta: dateText(row.old_eta),
    newEta: dateText(row.new_eta),
    oldRisk: text(row.old_risk) ?? "unknown",
    newRisk: text(row.new_risk) ?? "unknown",
    downstreamSnapshotNodeIds: downstream,
  };
}

export function readWorkshopQueuePreview(body: unknown): WorkshopQueuePreviewView | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  const workshopId = whole(row.workshop_id);
  const revision = text(row.revision);
  const fingerprint = text(row.preview_fingerprint);
  if (workshopId == null || revision == null || revision.length !== 64 || fingerprint == null || fingerprint.length !== 64) {
    return null;
  }
  if (!Array.isArray(row.changes)) return null;
  const changes: WorkshopQueueChangeView[] = [];
  for (const change of row.changes) {
    const parsed = readChange(change);
    if (!parsed) return null;
    changes.push(parsed);
  }
  return {
    workshopId,
    revision,
    fingerprint,
    canApply: row.can_apply === true,
    changes,
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
    blockers: Array.isArray(row.blockers) ? row.blockers : [],
  };
}

export function readAppliedWorkshopQueue(body: unknown): WorkshopQueueSection | null {
  if (!body || typeof body !== "object") return null;
  return readWorkshopQueue((body as { queue?: unknown }).queue);
}

export function workshopQueueManagerMessage(code: string | null, backendMessage: string | null): string {
  if (code && MANAGER_MESSAGES[code]) return MANAGER_MESSAGES[code];
  const message = backendMessage?.trim();
  if (message) return message;
  return "Не удалось изменить очередь.";
}

export function readQueueConflict(body: unknown, headerCode: string | null): WorkshopQueueConflict {
  const detail = body && typeof body === "object" && "detail" in body
    ? (body as { detail?: unknown }).detail
    : null;
  let backendMessage: string | null = null;
  let diagnostic: Record<string, unknown> | null = null;
  if (typeof detail === "string") backendMessage = detail;
  else if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const row = detail as { message?: unknown; diagnostic?: unknown };
    if (typeof row.message === "string") backendMessage = row.message;
    if (row.diagnostic && typeof row.diagnostic === "object" && !Array.isArray(row.diagnostic)) {
      diagnostic = row.diagnostic as Record<string, unknown>;
    }
  }
  const diagnosticCode = diagnostic && typeof diagnostic.code === "string" ? diagnostic.code : null;
  const code = headerCode?.trim() || diagnosticCode;
  return {
    code,
    stale: code === "workshop_queue_changed",
    message: workshopQueueManagerMessage(code, backendMessage),
    diagnostic,
  };
}

export function workshopQueueHttpMessage(status: number, conflict: WorkshopQueueConflict): string {
  if (status === 401) return "Нужен вход в свою учётную запись.";
  if (status === 403) return "Недостаточно прав, чтобы менять очередь участка.";
  if (status === 404) return "Участок не найден или отключён.";
  if (conflict.code) return conflict.message;
  if (status === 422) return "Проверьте порядок очереди и повторите предпросмотр.";
  return conflict.message;
}

export function presentQueueItems(
  items: readonly WorkshopQueueItem[],
  facts: ReadonlyMap<number, { model: string; quantity: string }>,
): WorkshopQueueRow[] {
  return items.map((item) => {
    const fact = facts.get(item.technicalCardId);
    return {
      ...item,
      model: fact?.model?.trim() || "—",
      quantity: fact?.quantity?.trim() || "—",
    };
  });
}

export function cardFactLabel(card: {
  product_model_article?: string | null;
  product_model_name?: string | null;
  quantity?: string | number | null;
}): { model: string; quantity: string } {
  const model = [card.product_model_article, card.product_model_name].filter(Boolean).join(" · ");
  const quantity = productionQuantityLabel(card.quantity);
  return { model: model || "—", quantity };
}

function locked(item: WorkshopQueueItem): boolean {
  return item.protected || item.readOnly;
}

export function moveQueueItem<T extends WorkshopQueueItem>(
  items: readonly T[],
  snapshotNodeId: number,
  direction: -1 | 1,
): T[] | null {
  const index = items.findIndex((row) => row.snapshotNodeId === snapshotNodeId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return null;
  if (locked(items[index]) || locked(items[target])) return null;
  const next = [...items];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next.map((row, position) => ({ ...row, position: position + 1 }));
}

export function sameNodeOrder(left: readonly WorkshopQueueItem[], right: readonly WorkshopQueueItem[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((row, index) => row.snapshotNodeId === right[index]?.snapshotNodeId);
}

export function workshopQueuePreviewBody(revision: string, items: readonly WorkshopQueueItem[]) {
  return {
    revision,
    ordered_snapshot_node_ids: items.map((row) => row.snapshotNodeId),
  };
}

export function workshopQueueApplyBody(
  revision: string,
  items: readonly WorkshopQueueItem[],
  fingerprint: string,
) {
  return {
    ...workshopQueuePreviewBody(revision, items),
    preview_fingerprint: fingerprint,
  };
}

export function canApplyWorkshopQueue(input: {
  canReorder: boolean;
  busy: boolean;
  preview: WorkshopQueuePreviewView | null;
  previewOrder: readonly number[] | null;
  draft: readonly WorkshopQueueItem[];
}): boolean {
  if (!input.canReorder || input.busy || !input.preview?.canApply || !input.preview.fingerprint || !input.previewOrder) {
    return false;
  }
  if (input.previewOrder.length !== input.draft.length) return false;
  return input.previewOrder.every((id, index) => id === input.draft[index]?.snapshotNodeId);
}

export function queueRiskLabel(risk: string): string {
  if (risk === "late") return "Риск срока";
  if (risk === "on_time") return "В срок";
  if (risk === "unknown") return "Срок не определён";
  return risk;
}

export function queueDateLabel(value: string | null): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function queueStatusLabel(status: string): string {
  return status === "waiting" ? "Ожидает" : status;
}

export function downstreamLabels(
  ids: readonly number[],
  items: readonly WorkshopQueueItem[],
): { names: string[]; hiddenIds: number[] } {
  const byNode = new Map(items.map((item) => [item.snapshotNodeId, item.number]));
  const names: string[] = [];
  const hiddenIds: number[] = [];
  for (const id of ids) {
    const name = byNode.get(id);
    if (name) names.push(name);
    else hiddenIds.push(id);
  }
  return { names, hiddenIds };
}

export function replaceWorkshopQueue(
  sections: readonly WorkshopQueueSection[],
  next: WorkshopQueueSection,
): WorkshopQueueSection[] {
  const exists = sections.some((section) => section.workshopId === next.workshopId);
  if (!exists) return [...sections, next];
  return sections.map((section) => (section.workshopId === next.workshopId ? next : section));
}
