import type { StatusBadgeTone } from "@/components/ui/status-badge";

/** Specification plan+fact report (ADR-031 / Stage 7.2.2). */

export type SpecificationVersionStatus =
  | "draft"
  | "approved"
  | "superseded"
  | "cancelled";

export type ApiSpecificationListItem = {
  id: number;
  number: string;
  production_batch_id: number;
  production_batch_number: string | null;
  sales_order_id: number;
  sales_order_number: string | null;
  production_order_id: number;
  production_order_number: string | null;
  current_version_no: number | null;
  current_version_status: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiSpecificationProductLine = {
  id: number;
  sequence: number;
  technical_card_id: number;
  sales_order_item_id: number | null;
  nomenclature_id: number | null;
  nomenclature_name: string | null;
  nomenclature_type: string | null;
  product_model_id: number | null;
  product_model_article: string | null;
  product_model_name: string | null;
  assembly_variant_id: number | null;
  assembly_variant_name: string | null;
  quantity: string | number;
  created_at: string;
  updated_at: string;
};

export type ApiSpecificationMaterialLine = {
  id: number;
  sequence: number;
  nomenclature_id: number | null;
  snapshot_name: string;
  unit: string | null;
  production_stage_id: number | null;
  planned_qty: string | number | null;
  fact_qty: string | number | null;
  created_at: string;
  updated_at: string;
};

export type ApiSpecificationOperationLine = {
  id: number;
  sequence: number;
  source_kind: string;
  technical_card_id: number | null;
  tech_operation_id: number | null;
  sewing_operation_id: number | null;
  operation_name: string;
  volume_unit: string;
  planned_volume: string | number;
  fact_volume: string | number | null;
  duration_seconds: number | null;
  performer_name: string | null;
  production_stage_id: number | null;
  stage_label: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiSpecificationVersionSummary = {
  id: number;
  version_no: number;
  status: string;
  approved_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiSpecificationVersion = ApiSpecificationVersionSummary & {
  product_lines: ApiSpecificationProductLine[];
  material_lines: ApiSpecificationMaterialLine[];
  operation_lines: ApiSpecificationOperationLine[];
};

export type ApiSpecification = ApiSpecificationListItem & {
  notes: string | null;
  versions: ApiSpecificationVersionSummary[];
  current_version: ApiSpecificationVersion | null;
};

export type SpecificationListItem = ApiSpecificationListItem;
export type SpecificationDetail = ApiSpecification;

export type SpecificationsListParams = {
  production_batch_id?: number;
  production_order_id?: number;
  sales_order_id?: number;
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export function specificationStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "draft":
      return "Черновик";
    case "approved":
      return "Утверждена";
    case "superseded":
      return "Заменена";
    case "cancelled":
      return "Снята";
    default:
      return status?.trim() || "—";
  }
}

export function specificationStatusTone(
  status: string | null | undefined,
): StatusBadgeTone {
  switch (status) {
    case "draft":
      return "neutral";
    case "approved":
      return "success";
    case "superseded":
      return "warning";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

export function specificationOperationSourceLabel(kind: string): string {
  switch (kind) {
    case "sewing":
      return "Пошив";
    case "routing":
      return "Маршрут";
    default:
      return kind;
  }
}

export function formatSpecificationQty(
  value: string | number | null | undefined,
): string {
  if (value == null || value === "") return "—";
  return String(value);
}

export function formatSpecificationDuration(
  seconds: number | null | undefined,
): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  return `${seconds} с`;
}

export function specificationMatchesQuery(
  item: Pick<
    SpecificationListItem,
    | "number"
    | "production_batch_number"
    | "sales_order_number"
    | "production_order_number"
  >,
  query: string,
): boolean {
  const needle = query.trim().toLocaleLowerCase("ru");
  if (!needle) return true;
  return [
    item.number,
    item.production_batch_number ?? "",
    item.sales_order_number ?? "",
    item.production_order_number ?? "",
  ].some((value) => value.toLocaleLowerCase("ru").includes(needle));
}

export function specificationsByBatchId(
  items: ReadonlyArray<SpecificationListItem>,
): Record<number, SpecificationListItem> {
  const map: Record<number, SpecificationListItem> = {};
  for (const item of items) {
    map[item.production_batch_id] = item;
  }
  return map;
}
