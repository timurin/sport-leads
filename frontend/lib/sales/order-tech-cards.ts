import type {
  ApiTechnicalCard,
  ApiTechnicalCardPreview,
} from "@/lib/sales/order-tech-cards-api";

export type TechCardUiStatus =
  | "missing"
  | "draft"
  | "in_progress"
  | "completed"
  | "cancelled";

export type OrderTechCardRow = {
  key: string;
  salesOrderItemId: number;
  position: number;
  productName: string;
  quantity: number;
  number: string;
  status: TechCardUiStatus;
  statusLabel: string;
  currentStage: string;
  unitLineCount: number | null;
  href: string | null;
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
  manufacturingComplete: boolean;
  statusLabel: string;
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

export function buildOrderTechCardRows(
  preview: ApiTechnicalCardPreview,
  cards: ApiTechnicalCard[],
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

      return {
        key: `item-${line.sales_order_item_id}`,
        salesOrderItemId: line.sales_order_item_id,
        position: line.position,
        productName: line.snapshot_name,
        quantity: asQuantity(line.quantity),
        number: active?.number ?? "—",
        status,
        statusLabel: STATUS_LABEL[status],
        currentStage: active?.current_stage_label ?? "—",
        unitLineCount: active
          ? active.unit_lines?.length ?? line.planned_unit_line_count
          : line.planned_unit_line_count,
        href: active ? `/production/tech-cards/${active.id}` : null,
      };
    });
}

export function buildOrderTechCardsSummary(
  orderId: number | string,
  rows: OrderTechCardRow[],
  cards: ApiTechnicalCard[],
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
  const completenessPercent =
    eligibleCount === 0 ? 0 : Math.round((completedCount / eligibleCount) * 100);
  const manufacturingComplete =
    eligibleCount > 0 && completedCount === eligibleCount && missingCount === 0;

  let statusLabel = "Нет производимых позиций";
  if (eligibleCount > 0) {
    if (manufacturingComplete) statusLabel = "Производство закрыто по техкартам";
    else if (missingCount > 0) statusLabel = "Есть позиции без активной ТК";
    else if (inProgressCount > 0) statusLabel = "Техкарты в работе";
    else statusLabel = "Черновики техкарт";
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
    manufacturingComplete,
    statusLabel,
    openListHref: `/production/tech-cards?orderId=${orderId}`,
  };
}

export function techCardStatusLabel(status: TechCardUiStatus): string {
  return STATUS_LABEL[status];
}
