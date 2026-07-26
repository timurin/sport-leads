import type { StatusBadgeTone } from "@/components/ui/status-badge";
import type {
  ApiTechnicalCardListItem,
  TechnicalCardStageResultStatus,
} from "@/lib/sales/order-tech-cards-api";
import type { TechCardUiStatus } from "@/lib/sales/order-tech-cards";

export type TechCardClientFilter = {
  search?: string;
  status?: string;
  stage?: string;
};

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

export function techCardStatusTone(status: string): StatusBadgeTone {
  return STATUS_TONE[asTechCardUiStatus(status)];
}

export function filterTechCardsClient(
  cards: ApiTechnicalCardListItem[],
  filters: TechCardClientFilter,
): ApiTechnicalCardListItem[] {
  const search = filters.search?.trim().toLowerCase() ?? "";
  const status = filters.status?.trim() ?? "";
  const stage = filters.stage?.trim().toLowerCase() ?? "";

  return cards.filter((card) => {
    if (status && String(card.status) !== status) return false;
    if (stage && !(card.current_stage_label ?? "").toLowerCase().includes(stage)) {
      return false;
    }
    if (!search) return true;

    const haystack = [
      card.number,
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
  sales_order_item_id: number;
}): string {
  return card.nomenclature_name ?? `Строка #${card.sales_order_item_id}`;
}

export function techCardOrderLabel(card: {
  order_number: string | null | undefined;
  sales_order_id: number;
}): string {
  return card.order_number?.trim() || `#${card.sales_order_id}`;
}

export function compositionLineKindLabel(kind: string): string {
  if (kind === "material") return "Материал";
  if (kind === "pattern") return "Лекала";
  if (kind === "note") return "Примечание";
  return kind;
}
