import type { StatusBadgeTone } from "@/components/ui/status-badge";

/** Production orders / batches API client (ADR-018 / 11.1.1.4). */

export type ProductionOrderListItem = {
  id: number;
  sales_order_id: number;
  sales_order_number: string | null;
  number: string;
  order_seq: number;
  status: string;
  notes: string | null;
  batch_count: number;
  created_at: string;
  updated_at: string;
};

export type ProductionBatchCardLink = {
  id: number;
  production_batch_id: number;
  technical_card_id: number;
  technical_card_number: string | null;
  created_at: string;
};

export type ProductionBatch = {
  id: number;
  production_order_id: number;
  number: string;
  batch_seq: number;
  status: string;
  notes: string | null;
  card_links: ProductionBatchCardLink[];
  created_at: string;
  updated_at: string;
};

export type ProductionOrderDetail = {
  id: number;
  sales_order_id: number;
  sales_order_number: string | null;
  number: string;
  order_seq: number;
  status: string;
  notes: string | null;
  batches: ProductionBatch[];
  created_at: string;
  updated_at: string;
};

export type ProductionFactRollupMaterialLine = {
  nomenclature_id: number | null;
  snapshot_name: string;
  unit: string | null;
  planned_qty: string | null;
  fact_qty: string | null;
};

export type ProductionFactRollupOperationLine = {
  operation_name: string;
  volume_unit: string | null;
  stage_order: number | null;
  stage_label: string | null;
  volume: string;
};

export type ProductionFactRollupPerformer = {
  performer_name: string;
  stage_labels: string[];
};

export type ProductionFactRollup = {
  scope: string;
  production_order_id: number | null;
  production_batch_id: number | null;
  technical_card_count: number;
  technical_card_ids: number[];
  quantity_total: string;
  cards_completed: number;
  cards_in_progress: number;
  cards_other: number;
  duration_seconds_total: number;
  scrap_qty_total: string;
  rework_qty_total: string;
  performers: ProductionFactRollupPerformer[];
  materials: ProductionFactRollupMaterialLine[];
  operations: ProductionFactRollupOperationLine[];
};

export type ProductionOrdersListParams = {
  sales_order_id?: number;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

function apiBaseUrl(): string {
  return (
    process.env.SPORT_LEADS_API_URL ??
    process.env.NEXT_PUBLIC_SPORT_LEADS_API_URL ??
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string | unknown };
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
    if (Array.isArray(body.detail) && body.detail[0]) {
      const first = body.detail[0] as { msg?: string };
      if (typeof first.msg === "string" && first.msg.trim()) return first.msg;
    }
  } catch {
    /* ignore */
  }
  return `${fallback} (${response.status})`;
}

export const PRODUCTION_ORDER_STATUS_KPI: ReadonlyArray<{
  status: "draft" | "in_progress" | "completed" | "cancelled";
  label: string;
}> = [
  { status: "in_progress", label: "В работе" },
  { status: "draft", label: "Черновик" },
  { status: "completed", label: "Завершён" },
  { status: "cancelled", label: "Отменён" },
];

export function countProductionOrdersByStatus(
  orders: ReadonlyArray<{ status: string }>,
): Record<(typeof PRODUCTION_ORDER_STATUS_KPI)[number]["status"], number> {
  const counts = {
    draft: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  };
  for (const row of orders) {
    if (row.status in counts) {
      counts[row.status as keyof typeof counts] += 1;
    }
  }
  return counts;
}

export function productionOrderStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Черновик";
    case "in_progress":
      return "В работе";
    case "completed":
      return "Завершён";
    case "cancelled":
      return "Отменён";
    default:
      return status;
  }
}

export function productionBatchStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Черновик";
    case "released":
      return "Выпущена";
    case "in_progress":
      return "В работе";
    case "completed":
      return "Завершена";
    case "cancelled":
      return "Отменена";
    default:
      return status;
  }
}

export function productionOrderStatusTone(status: string): StatusBadgeTone {
  switch (status) {
    case "draft":
      return "neutral";
    case "in_progress":
      return "primary";
    case "completed":
      return "success";
    case "cancelled":
      return "danger";
    case "released":
      return "warning";
    default:
      return "neutral";
  }
}

export function filterProductionOrdersClient(
  rows: ProductionOrderListItem[],
  query: string,
): ProductionOrderListItem[] {
  const needle = query.trim().toLocaleLowerCase("ru");
  if (!needle) return rows;
  return rows.filter(
    (row) =>
      row.number.toLocaleLowerCase("ru").includes(needle) ||
      (row.sales_order_number ?? "").toLocaleLowerCase("ru").includes(needle) ||
      String(row.sales_order_id).includes(needle),
  );
}

function buildListQuery(params: ProductionOrdersListParams): string {
  const query = new URLSearchParams();
  if (params.sales_order_id != null) {
    query.set("sales_order_id", String(params.sales_order_id));
  }
  if (params.status?.trim()) query.set("status", params.status.trim());
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export async function fetchProductionOrders(
  params: ProductionOrdersListParams = {},
): Promise<ProductionOrderListItem[]> {
  const response = await fetch(
    `${apiBaseUrl()}/production-orders${buildListQuery(params)}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Не удалось загрузить производственные заказы"));
  }
  return (await response.json()) as ProductionOrderListItem[];
}

export async function fetchProductionOrder(
  orderId: number | string,
): Promise<ProductionOrderDetail> {
  const response = await fetch(`${apiBaseUrl()}/production-orders/${orderId}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Не удалось загрузить производственный заказ"));
  }
  return (await response.json()) as ProductionOrderDetail;
}

export async function createProductionOrderApi(payload: {
  sales_order_id: number;
  notes?: string | null;
}): Promise<ProductionOrderDetail> {
  const response = await fetch(`${apiBaseUrl()}/production-orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Не удалось создать производственный заказ"));
  }
  return (await response.json()) as ProductionOrderDetail;
}

export async function createProductionBatchApi(
  orderId: number | string,
  payload: { notes?: string | null; technical_card_ids?: number[] } = {},
): Promise<ProductionBatch> {
  const response = await fetch(`${apiBaseUrl()}/production-orders/${orderId}/batches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Не удалось создать партию"));
  }
  return (await response.json()) as ProductionBatch;
}

export async function attachTechnicalCardToBatchApi(
  batchId: number | string,
  technicalCardId: number,
): Promise<ProductionBatch> {
  const response = await fetch(`${apiBaseUrl()}/production-batches/${batchId}/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ technical_card_id: technicalCardId }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Не удалось привязать техкарту"));
  }
  return (await response.json()) as ProductionBatch;
}

export async function detachTechnicalCardFromBatchApi(
  batchId: number | string,
  technicalCardId: number,
): Promise<ProductionBatch> {
  const response = await fetch(
    `${apiBaseUrl()}/production-batches/${batchId}/cards/${technicalCardId}`,
    { method: "DELETE", cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Не удалось отвязать техкарту"));
  }
  return (await response.json()) as ProductionBatch;
}

export async function fetchProductionOrderFactRollup(
  orderId: number | string,
): Promise<ProductionFactRollup> {
  const response = await fetch(
    `${apiBaseUrl()}/production-orders/${orderId}/fact-rollup`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(
      await readError(response, "Не удалось загрузить сводку факта заказа"),
    );
  }
  return (await response.json()) as ProductionFactRollup;
}

export async function fetchProductionBatchFactRollup(
  batchId: number | string,
): Promise<ProductionFactRollup> {
  const response = await fetch(
    `${apiBaseUrl()}/production-batches/${batchId}/fact-rollup`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(
      await readError(response, "Не удалось загрузить сводку факта партии"),
    );
  }
  return (await response.json()) as ProductionFactRollup;
}

/** One request for all batch rollups of a production order (`0.2.6`). */
export async function fetchProductionOrderBatchFactRollups(
  orderId: number | string,
): Promise<Record<number, ProductionFactRollup>> {
  const response = await fetch(
    `${apiBaseUrl()}/production-orders/${orderId}/batch-fact-rollups`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(
      await readError(response, "Не удалось загрузить сводки факта партий"),
    );
  }
  const items = (await response.json()) as ProductionFactRollup[];
  return Object.fromEntries(
    items
      .filter((item) => item.production_batch_id != null)
      .map((item) => [item.production_batch_id as number, item]),
  );
}

/** Strip trailing zeros from API decimal strings for compact UI. */
export function formatRollupQty(value: string | null | undefined): string {
  if (value == null || value.trim() === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return String(num);
}
