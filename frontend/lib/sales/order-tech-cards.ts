import { techCardVisibleNumber } from "../production/tech-card-display.ts";
import type {
  ApiTechnicalCardListItem,
  ApiTechnicalCardPreview,
  ApiTechnicalCardStageResult,
} from "@/lib/sales/order-tech-cards-api";

export type TechCardUiStatus =
  | "missing"
  | "draft"
  | "in_progress"
  | "completed"
  | "cancelled";

export type OrderTechCardStageStripKind = "done" | "active" | "upcoming";

export type OrderTechCardStageStrip = {
  order: number;
  label: string;
  kind: OrderTechCardStageStripKind;
};

export type OrderTechCardRow = {
  key: string;
  salesOrderItemId: number;
  position: number;
  productName: string;
  quantity: number;
  number: string;
  title: string;
  status: TechCardUiStatus;
  statusLabel: string;
  currentStage: string;
  unitLineCount: number | null;
  href: string | null;
  stageStrips: OrderTechCardStageStrip[];
};

export type OrderTechCardListCard = Pick<
  ApiTechnicalCardListItem,
  "id" | "sales_order_item_id" | "number" | "status" | "current_stage_label"
> & {
  stage_results?: ApiTechnicalCardStageResult[];
  unit_lines?: readonly unknown[];
};

export type OrderTechCardsSummary = {
  eligibleCount: number;
  presentCount: number;
  missingCount: number;
  draftCount: number;
  inProgressCount: number;
  completedCount: number;
  cancelledCount: number;
  completenessPercent: number;
  readinessPercent: number;
  manufacturingComplete: boolean;
  statusLabel: string;
  plannedCount: number | null;
  createdVsPlannedLabel: string | null;
  openListHref: string;
};

const STATUS_LABEL: Record<TechCardUiStatus, string> = {
  missing: "Нет ТК",
  draft: "Черновик",
  in_progress: "В работе",
  completed: "Завершена",
  cancelled: "Отменена",
};

function asUiStatus(status: string): TechCardUiStatus {
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

function asQuantity(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildTechCardStageStrips(
  stages: ApiTechnicalCardStageResult[] | null | undefined,
): OrderTechCardStageStrip[] {
  return sortStages(stages ?? []).map((stage) => {
    const status = String(stage.status);
    const kind: OrderTechCardStageStripKind = isDoneStage(status)
      ? "done"
      : status === "in_progress"
        ? "active"
        : "upcoming";
    return {
      order: stage.stage_order,
      label: stage.stage_label,
      kind,
    };
  });
}

export function buildOrderTechCardRows(
  preview: ApiTechnicalCardPreview,
  cards: OrderTechCardListCard[],
): OrderTechCardRow[] {
  const byItem = new Map(cards.map((card) => [card.sales_order_item_id, card]));

  return preview.lines
    .filter((line) => line.eligible)
    .map((line) => {
      const card = byItem.get(line.sales_order_item_id) ?? null;
      const active = card && card.status !== "cancelled" ? card : null;
      const status: TechCardUiStatus = active
        ? asUiStatus(String(active.status))
        : card?.status === "cancelled"
          ? "cancelled"
          : "missing";
      const number = active ? techCardVisibleNumber(active) : "—";
      const title = `${number === "—" ? `Позиция ${line.position}` : number} — ${line.snapshot_name}`;

      return {
        key: `item-${line.sales_order_item_id}`,
        salesOrderItemId: line.sales_order_item_id,
        position: line.position,
        productName: line.snapshot_name,
        quantity: asQuantity(line.quantity),
        number,
        title,
        status,
        statusLabel: STATUS_LABEL[status],
        currentStage: active?.current_stage_label ?? "—",
        unitLineCount: active
          ? active.unit_lines?.length ?? line.planned_unit_line_count
          : line.planned_unit_line_count,
        href: active ? `/production/tech-cards/${active.id}` : null,
        stageStrips: buildTechCardStageStrips(active?.stage_results),
      };
    });
}

function normalizeStageCode(label: string | null | undefined): string {
  const raw = label?.trim().toLowerCase() ?? "";
  if (raw === "ready_to_ship" || raw === "готовы к отгрузке") return "ready_to_ship";
  if (raw === "shipped" || raw === "отгружен" || raw === "отгружено" || raw === "отгружены") {
    return "shipped";
  }
  return raw;
}

function isDoneStage(status: string | null | undefined): boolean {
  return status === "completed" || status === "skipped";
}

function sortStages(stages: ApiTechnicalCardStageResult[]): ApiTechnicalCardStageResult[] {
  return [...stages].sort((left, right) => left.stage_order - right.stage_order);
}

/** 0 = TC not launched; 100 = ready to ship (ready_to_ship done or already shipped). */
export function techCardReadinessPercent(
  row: OrderTechCardRow,
  card: OrderTechCardListCard | null,
): number {
  if (!card || row.status === "missing" || row.status === "cancelled") return 0;
  if (row.status === "completed") return 100;
  if (normalizeStageCode(card.current_stage_label) === "shipped") return 100;

  const stages = sortStages(card.stage_results ?? []);
  if (stages.length === 0) return 0;

  const shipIndex = stages.findIndex(
    (stage) => normalizeStageCode(stage.stage_label) === "ready_to_ship",
  );
  const relevant = shipIndex >= 0 ? stages.slice(0, shipIndex + 1) : stages;
  if (relevant.some((stage) => (
    normalizeStageCode(stage.stage_label) === "ready_to_ship" && isDoneStage(String(stage.status))
  ))) {
    return 100;
  }

  const done = relevant.filter((stage) => isDoneStage(String(stage.status))).length;
  if (done === 0) return 0;
  return Math.round((done / relevant.length) * 100);
}

export function buildOrderTechCardsSummary(
  orderId: number | string,
  rows: OrderTechCardRow[],
  cards: OrderTechCardListCard[],
  plannedCount: number | null = null,
): OrderTechCardsSummary {
  const eligibleCount = rows.length;
  const draftCount = rows.filter((row) => row.status === "draft").length;
  const inProgressCount = rows.filter((row) => row.status === "in_progress").length;
  const completedCount = rows.filter((row) => row.status === "completed").length;
  const cancelledCount = rows.filter((row) => row.status === "cancelled").length;
  const missingCount = rows.filter(
    (row) => row.status === "missing" || row.status === "cancelled",
  ).length;
  const presentCount = cards.length;
  const byItem = new Map(cards.map((card) => [card.sales_order_item_id, card]));
  const readinessPercent = eligibleCount === 0
    ? 0
    : Math.round(
      rows.reduce((sum, row) => {
        const card = byItem.get(row.salesOrderItemId) ?? null;
        const active = card && card.status !== "cancelled" ? card : null;
        return sum + techCardReadinessPercent(row, active);
      }, 0) / eligibleCount,
    );
  const completenessPercent = readinessPercent;
  const manufacturingComplete = eligibleCount > 0 && readinessPercent === 100;

  let statusLabel = "Нет производимых позиций";
  if (eligibleCount > 0) {
    if (manufacturingComplete) statusLabel = "Производство закрыто по техкартам";
    else if (missingCount > 0) statusLabel = "Есть позиции без активной ТК";
    else if (inProgressCount > 0) statusLabel = "Техкарты в работе";
    else statusLabel = "Черновики техкарт";
  }

  let createdVsPlannedLabel: string | null = null;
  if (plannedCount != null && plannedCount >= 1) {
    createdVsPlannedLabel = `${presentCount} из ${plannedCount}`;
  }

  return {
    eligibleCount,
    presentCount,
    missingCount,
    draftCount,
    inProgressCount,
    completedCount,
    cancelledCount,
    completenessPercent,
    readinessPercent,
    manufacturingComplete,
    statusLabel,
    plannedCount,
    createdVsPlannedLabel,
    openListHref: `/production/tech-cards?orderId=${orderId}`,
  };
}

export function techCardStatusLabel(status: TechCardUiStatus): string {
  return STATUS_LABEL[status];
}
