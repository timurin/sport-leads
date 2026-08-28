import { rasterImageMimeOrNull } from "../api-media.ts";
import type { StatusBadgeTone } from "@/components/ui/status-badge";
import type {
  ApiTechnicalCard,
  ApiTechnicalCardListItem,
  ApiTechnicalCardOperationLine,
  ApiTechnicalCardStageResult,
  TechnicalCardStageResultStatus,
} from "@/lib/sales/order-tech-cards-api";
import type { TechCardUiStatus } from "@/lib/sales/order-tech-cards";

export type TechCardListView = "list" | "kanban";

export function parseTechCardListView(
  raw: string | null | undefined,
): TechCardListView {
  return raw === "kanban" ? "kanban" : "list";
}

export type TechCardClientFilter = {
  search?: string;
  status?: string;
  stage?: string;
  responsible?: string;
};

/** Max mockup images on a technical card document. */
export const TECH_CARD_MEDIA_MAX = 3;

export const TECH_CARD_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const TECH_CARD_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const TECH_CARD_IMAGE_RULE = "JPEG / PNG / WebP, до 10 МБ";

export function validateTechCardImageFile(file: File): string | null {
  if (rasterImageMimeOrNull(file) == null) {
    return TECH_CARD_IMAGE_RULE;
  }
  if (file.size <= 0 || file.size > TECH_CARD_IMAGE_MAX_BYTES) {
    return TECH_CARD_IMAGE_RULE;
  }
  return null;
}

const STATUS_TONE: Record<TechCardUiStatus, StatusBadgeTone> = {
  missing: "neutral",
  draft: "warning",
  in_progress: "primary",
  completed: "success",
  cancelled: "neutral",
};

const STAGE_RESULT_LABEL: Record<TechnicalCardStageResultStatus, string> = {
  pending: "Ожидает",
  in_progress: "В работе",
  completed: "Завершён",
  skipped: "Пропущен",
};

const VOLUME_UNIT_LABEL: Record<string, string> = {
  linear_meters: "м.п.",
  pieces: "шт.",
};

const UNIT_LINE_SIZE_TYPE_LABEL: Record<string, string> = {
  male: "Мужской",
  female: "Женский",
  // Legacy aliases (pre-9.3.2.5 men/women/kids)
  men: "Мужской",
  women: "Женский",
  kids: "Детский",
};

export function asTechCardUiStatus(status: string): TechCardUiStatus {
  if (
    status === "draft" ||
    status === "in_progress" ||
    status === "completed" ||
    status === "cancelled"
  ) {
    return status;
  }
  return "draft";
}

/** Stage badge in header when a current stage is known (incl. draft with routing). */
export function techCardShowsCurrentStageBadge(status: string): boolean {
  const ui = asTechCardUiStatus(status);
  return ui !== "cancelled";
}

/** Stage start/complete/rollback while card is executable (matches backend `_assert_card_executable`). */
export function techCardAllowsStageExecution(status: string): boolean {
  const ui = asTechCardUiStatus(status);
  return ui === "draft" || ui === "in_progress";
}

export function techCardStatusTone(status: string): StatusBadgeTone {
  return STATUS_TONE[asTechCardUiStatus(status)];
}

export function filterTechCardsClient(
  cards: ApiTechnicalCardListItem[],
  filters: TechCardClientFilter & { statusField?: "card" | "stage" },
): ApiTechnicalCardListItem[] {
  const search = filters.search?.trim().toLowerCase() ?? "";
  const status = filters.status?.trim() ?? "";
  const stage = filters.stage?.trim().toLowerCase() ?? "";
  const responsible = filters.responsible?.trim().toLowerCase() ?? "";
  const statusField = filters.statusField ?? "card";

  return cards.filter((card) => {
    if (status) {
      const value =
        statusField === "stage"
          ? techCardShopStageStatus(card)
          : String(card.status);
      if (value !== status) return false;
    }
    if (stage && !(card.current_stage_label ?? "").toLowerCase().includes(stage)) {
      return false;
    }
    if (
      responsible &&
      !(card.responsible_name ?? "").toLowerCase().includes(responsible)
    ) {
      return false;
    }
    if (!search) return true;

    const haystack = [
      card.number,
      card.display_number,
      card.order_number,
      card.nomenclature_name,
      card.product_model_article,
      card.product_model_name,
      card.current_stage_label,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  });
}

export function formatVolumeUnit(unit: string): string {
  return VOLUME_UNIT_LABEL[unit] ?? unit;
}

export function unitLineSizeTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return UNIT_LINE_SIZE_TYPE_LABEL[value] ?? value;
}

export function stageResultStatusLabel(status: string): string {
  if (
    status === "pending" ||
    status === "in_progress" ||
    status === "completed" ||
    status === "skipped"
  ) {
    return STAGE_RESULT_LABEL[status];
  }
  return status;
}

const STAGE_RESULT_TONE: Record<TechnicalCardStageResultStatus, StatusBadgeTone> = {
  pending: "warning",
  in_progress: "primary",
  completed: "success",
  skipped: "neutral",
};

export function stageResultStatusTone(status: string): StatusBadgeTone {
  if (
    status === "pending" ||
    status === "in_progress" ||
    status === "completed" ||
    status === "skipped"
  ) {
    return STAGE_RESULT_TONE[status];
  }
  return "neutral";
}

/** Current stage-result row for a card (shop queue / kanban badge). */
export function techCardCurrentStageResult(
  card: Pick<ApiTechnicalCard, "current_stage_order" | "current_stage_label" | "stage_results">,
): ApiTechnicalCardStageResult | null {
  const stages = card.stage_results ?? [];
  if (stages.length === 0) return null;
  if (card.current_stage_order != null) {
    const byOrder = stages.find((row) => row.stage_order === card.current_stage_order);
    if (byOrder) return byOrder;
  }
  const label = card.current_stage_label?.trim().toLowerCase() ?? "";
  if (label) {
    const byLabel = stages.find((row) => row.stage_label.trim().toLowerCase() === label);
    if (byLabel) return byLabel;
  }
  return null;
}

/** Stage-result status for shop surfaces (falls back to pending when routing exists). */
export function techCardShopStageStatus(
  card: Pick<
    ApiTechnicalCard,
    "current_stage_order" | "current_stage_label" | "stage_results" | "status"
  >,
): string {
  const stage = techCardCurrentStageResult(card);
  if (stage) return String(stage.status);
  if (card.current_stage_label || card.current_stage_order != null) return "pending";
  return String(card.status);
}

export function formatTechCardDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function techCardModelLabel(card: {
  product_model_article: string | null;
  product_model_name: string | null;
}): string {
  return (
    [card.product_model_article, card.product_model_name].filter(Boolean).join(" · ") ||
    "—"
  );
}

export function techCardPositionLabel(card: {
  nomenclature_name: string | null;
  sales_order_item_id: number | null;
}): string {
  return card.nomenclature_name ?? (card.sales_order_item_id != null ? `Строка #${card.sales_order_item_id}` : "—");
}

export function techCardOrderLabel(card: {
  order_number: string | null | undefined;
  sales_order_id: number | null;
}): string {
  return card.order_number?.trim() || (card.sales_order_id != null ? `#${card.sales_order_id}` : "Без заказа");
}

export function compositionLineKindLabel(kind: string): string {
  if (kind === "material") return "Материал";
  if (kind === "pattern") return "Лекала";
  if (kind === "note") return "Примечание";
  return kind;
}

export type TechCardMaterialDraftLine = {
  key: string;
  nomenclature_id: number | null;
  snapshot_name: string;
  /** UI draft for planned qty (`9.3.4`); maps to API `planned_qty`. */
  quantity: string;
  /** Display-only fact qty (shop write); manager MVP read-only. */
  fact_qty: string;
  unit: string;
  production_stage_id: number | null;
  notes: string;
};

/** Keep pattern/note rows; rebuild material lines from editable drafts. */
export function buildCompositionReplaceLines(
  existing: Array<{
    line_kind: string;
    nomenclature_id: number | null;
    snapshot_name: string;
    planned_qty?: string | number | null;
    quantity?: string | number | null;
    production_stage_id?: number | null;
    unit: string | null;
    notes: string | null;
  }>,
  materials: TechCardMaterialDraftLine[],
): Array<{
  sequence: number;
  line_kind: "material" | "pattern" | "note";
  nomenclature_id: number | null;
  snapshot_name: string;
  planned_qty: string | number | null;
  production_stage_id: number | null;
  unit: string | null;
  notes: string | null;
}> {
  const preserved = existing.filter((row) => row.line_kind !== "material");
  const materialLines = materials
    .filter((row) => row.nomenclature_id != null && row.snapshot_name.trim())
    .map((row) => ({
      line_kind: "material" as const,
      nomenclature_id: row.nomenclature_id,
      snapshot_name: row.snapshot_name.trim(),
      planned_qty: row.quantity.trim() ? row.quantity.trim() : null,
      production_stage_id: row.production_stage_id,
      unit: row.unit.trim() || null,
      notes: row.notes.trim() || null,
    }));
  return [...materialLines, ...preserved].map((row, index) => ({
    sequence: index + 1,
    line_kind: row.line_kind as "material" | "pattern" | "note",
    nomenclature_id: row.nomenclature_id,
    snapshot_name: row.snapshot_name,
    planned_qty:
      "planned_qty" in row
        ? row.planned_qty ?? null
        : ((row as { quantity?: string | number | null }).quantity ?? null),
    production_stage_id:
      "production_stage_id" in row ? (row.production_stage_id ?? null) : null,
    unit: row.unit,
    notes: row.notes,
  }));
}

export function materialDraftsFromComposition(
  lines: Array<{
    id: number;
    line_kind: string;
    nomenclature_id: number | null;
    snapshot_name: string;
    planned_qty?: string | number | null;
    quantity?: string | number | null;
    fact_qty?: string | number | null;
    production_stage_id?: number | null;
    unit: string | null;
    notes?: string | null;
  }>,
): TechCardMaterialDraftLine[] {
  return lines
    .filter((row) => row.line_kind === "material")
    .map((row) => {
      const planned =
        row.planned_qty != null
          ? row.planned_qty
          : row.quantity != null
            ? row.quantity
            : null;
      return {
        key: `m-${row.id}`,
        nomenclature_id: row.nomenclature_id,
        snapshot_name: row.snapshot_name,
        quantity: planned == null ? "" : String(planned),
        fact_qty: row.fact_qty == null ? "" : String(row.fact_qty),
        unit: row.unit ?? "",
        production_stage_id: row.production_stage_id ?? null,
        notes: row.notes ?? "",
      };
    });
}

/** Document title: `order / card` when order present, else card number only. */
export function techCardDocumentNumberLabel(
  orderNumber: string | null | undefined,
  cardNumber: string,
): string {
  const order = orderNumber?.trim();
  const card = cardNumber.trim();
  if (order) return `${order} / ${card}`;
  return card || "—";
}

export function groupOperationLinesBySource(
  lines: ApiTechnicalCardOperationLine[],
): {
  routing: ApiTechnicalCardOperationLine[];
  sewing: ApiTechnicalCardOperationLine[];
} {
  const routing: ApiTechnicalCardOperationLine[] = [];
  const sewing: ApiTechnicalCardOperationLine[] = [];
  for (const line of lines) {
    if (line.source_kind === "sewing") {
      sewing.push(line);
    } else {
      // Missing source_kind treated as routing (legacy rows).
      routing.push(line);
    }
  }
  return { routing, sewing };
}

/** Routing TechOperation bound to цех Пошив — host for nested sewing-ops block. */
export function isSewingStageRoutingLine(
  line: Pick<
    ApiTechnicalCardOperationLine,
    "production_stage_id" | "stage_label"
  >,
  sewingProductionStageId?: number | null,
): boolean {
  if (
    sewingProductionStageId != null &&
    line.production_stage_id === sewingProductionStageId
  ) {
    return true;
  }
  const label = (line.stage_label ?? "").toLocaleLowerCase("ru");
  return label.includes("пошив");
}

export function findSewingHostRoutingLineIndex(
  routingLines: ReadonlyArray<
    Pick<ApiTechnicalCardOperationLine, "production_stage_id" | "stage_label">
  >,
  sewingProductionStageId?: number | null,
): number {
  return routingLines.findIndex((line) =>
    isSewingStageRoutingLine(line, sewingProductionStageId),
  );
}

export type TechCardHistoryEntry = {
  key: string;
  title: string;
  description?: string;
  meta?: string;
};

function stageHistoryEntries(stageResults: ApiTechnicalCardStageResult[]): TechCardHistoryEntry[] {
  const entries: TechCardHistoryEntry[] = [];
  for (const stage of stageResults) {
    if (stage.started_at) {
      entries.push({
        key: `stage-start-${stage.id}`,
        title: `Этап начат: ${stage.stage_label}`,
        description: stage.performer_name ? `Исполнитель: ${stage.performer_name}` : undefined,
        meta: formatTechCardDateTime(stage.started_at),
      });
    }
    if (stage.completed_at) {
      entries.push({
        key: `stage-complete-${stage.id}`,
        title: `Этап завершён: ${stage.stage_label}`,
        description: stage.notes ?? undefined,
        meta: formatTechCardDateTime(stage.completed_at),
      });
    }
  }
  return entries;
}

export function buildTechCardHistoryEntries(card: ApiTechnicalCard): TechCardHistoryEntry[] {
  const entries: TechCardHistoryEntry[] = [
    {
      key: `card-created-${card.id}`,
      title: "Техкарта создана",
      description: techCardDocumentNumberLabel(card.order_number, card.number),
      meta: formatTechCardDateTime(card.created_at),
    },
    ...stageHistoryEntries(card.stage_results ?? []),
  ];
  if (card.updated_at && card.updated_at !== card.created_at) {
    entries.push({
      key: `card-updated-${card.id}`,
      title: "Последнее обновление",
      meta: formatTechCardDateTime(card.updated_at),
    });
  }
  return entries;
}

/** Format desired delivery date (`YYYY-MM-DD` or ISO datetime) for display. */
export function formatDesiredDate(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const raw = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return `${d}.${m}.${y}`;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
