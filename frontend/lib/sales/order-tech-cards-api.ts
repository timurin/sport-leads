import { sameOriginApiMediaUrl } from "../api-media.ts";

export type TechnicalCardStatus =
  | "draft"
  | "in_progress"
  | "completed"
  | "cancelled";

export type TechnicalCardStageResultStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "skipped";

export type TechnicalCardVolumeUnit = "linear_meters" | "pieces";

export type TechnicalCardCompositionLineKind = "material" | "pattern" | "note";

export type ApiTechnicalCardCompositionLine = {
  id: number;
  technical_card_id: number;
  sequence: number;
  line_kind: TechnicalCardCompositionLineKind | string;
  nomenclature_id: number | null;
  snapshot_name: string;
  planned_qty: string | number | null;
  fact_qty?: string | number | null;
  production_stage_id?: number | null;
  unit: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TechnicalCardCompositionLineWrite = {
  sequence: number;
  line_kind: TechnicalCardCompositionLineKind;
  nomenclature_id?: number | null;
  snapshot_name: string;
  planned_qty?: string | number | null;
  production_stage_id?: number | null;
  unit?: string | null;
  notes?: string | null;
};

export type ApiTechnicalCardUnitLine = {
  id: number;
  technical_card_id: number;
  unit_index: number;
  size_type?: string | null;
  size?: string | null;
  personalization?: string | null;
  print_number?: string | null;
  color?: string | null;
  notes?: string | null;
  production_stage_id?: number | null;
  last_transfer_kind?: string | null;
  fg_receipt_posted?: boolean;
  fg_issue_posted?: boolean;
  is_scrapped?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type TechnicalCardUnitLineAggregateImportRow = {
  size_type?: string | null;
  size?: string | null;
  personalization?: string | null;
  print_number?: string | null;
  quantity: number;
  notes?: string | null;
};

export type TechnicalCardUnitLineBulkUpdateItem = {
  id?: number | null;
  unit_index?: number | null;
  size_type?: string | null;
  size?: string | null;
  personalization?: string | null;
  print_number?: string | null;
  notes?: string | null;
};

export type TechnicalCardUnitLineWriteItem = {
  unit_index: number;
  size_type?: string | null;
  size?: string | null;
  personalization?: string | null;
  print_number?: string | null;
  notes?: string | null;
};

export type TechnicalCardOperationLineSourceKind = "routing" | "sewing";

export type ApiTechnicalCardOperationLine = {
  id: number;
  technical_card_id: number;
  sequence: number;
  source_kind?: TechnicalCardOperationLineSourceKind | string;
  tech_operation_id: number | null;
  sewing_operation_id?: number | null;
  operation_name: string;
  volume_unit: TechnicalCardVolumeUnit | string;
  volume: string | number;
  stage_order: number | null;
  production_stage_id?: number | null;
  stage_label: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiTechnicalCardMedia = {
  id: number;
  technical_card_id: number;
  filename: string;
  mime_type: string;
  file_size: number;
  sort_order: number;
  is_primary: boolean;
  content_url: string;
  created_at: string;
  updated_at: string;
};

export type ApiTechnicalCardAssemblySewingOp = {
  sequence: number;
  operation_name: string;
  cost: string | number;
  quantity_per_item?: number;
  line_total?: string | number;
  duration_seconds: number;
  sewing_operation_id?: number | null;
};

export type TechnicalCardMediaUploadPayload = {
  filename: string;
  mime_type: string;
  content_base64: string;
  is_primary?: boolean;
};

export type ApiTechnicalCardStageResult = {
  id: number;
  technical_card_id: number;
  stage_order: number;
  production_stage_id?: number | null;
  stage_label: string;
  status: TechnicalCardStageResultStatus | string;
  performer_name: string | null;
  started_at: string | null;
  completed_at: string | null;
  scrap_qty: string | number | null;
  rework_qty: string | number | null;
  notes: string | null;
  work_done?: string | null;
  duration_seconds?: number | null;
  work_center_id?: number | null;
  created_at: string;
  updated_at: string;
};

export type ApiTechnicalCard = {
  id: number;
  sales_order_id: number;
  sales_order_item_id: number;
  number: string;
  card_seq: number;
  status: TechnicalCardStatus | string;
  quantity: string | number;
  nomenclature_id: number | null;
  nomenclature_name: string | null;
  nomenclature_type?: string | null;
  product_model_id?: number | null;
  product_model_article: string | null;
  product_model_name: string | null;
  product_model_size_type?: string | null;
  product_model_cover_image_url?: string | null;
  assembly_variant_id?: number | null;
  assembly_variant_name: string | null;
  assembly_variant_total_cost?: string | number | null;
  specification_version_id?: number | null;
  specification_version_label?: string | null;
  routing_template_id?: number | null;
  routing_template_name?: string | null;
  current_stage_order: number | null;
  current_stage_label: string | null;
  qr_token?: string | null;
  scan_url?: string | null;
  scan_qr_svg?: string | null;
  wip_status?: string | null;
  design_mockup_url?: string | null;
  notes?: string | null;
  order_number?: string | null;
  client_name?: string | null;
  responsible_name?: string | null;
  desired_date?: string | null;
  composition_lines?: ApiTechnicalCardCompositionLine[];
  unit_lines: ApiTechnicalCardUnitLine[];
  operation_lines?: ApiTechnicalCardOperationLine[];
  stage_results?: ApiTechnicalCardStageResult[];
  media_items?: ApiTechnicalCardMedia[];
  assembly_sewing_operations?: ApiTechnicalCardAssemblySewingOp[];
  created_at: string;
  updated_at: string;
};

export type ApiTechnicalCardListItem = {
  id: number;
  sales_order_id: number;
  sales_order_item_id: number;
  number: string;
  card_seq: number;
  status: TechnicalCardStatus | string;
  quantity: string | number;
  nomenclature_id: number | null;
  nomenclature_name: string | null;
  nomenclature_type?: string | null;
  product_model_id?: number | null;
  product_model_article: string | null;
  product_model_name: string | null;
  product_model_size_type?: string | null;
  product_model_cover_image_url?: string | null;
  assembly_variant_id?: number | null;
  assembly_variant_name: string | null;
  assembly_variant_total_cost?: string | number | null;
  specification_version_id?: number | null;
  specification_version_label?: string | null;
  routing_template_id?: number | null;
  routing_template_name?: string | null;
  current_stage_order: number | null;
  current_stage_label: string | null;
  design_mockup_url?: string | null;
  notes?: string | null;
  order_number: string | null;
  client_name?: string | null;
  responsible_name?: string | null;
  desired_date?: string | null;
  /** Present for kanban/shop stage status; list omits fat nested collections (`0.2.3.3`). */
  stage_results?: ApiTechnicalCardStageResult[];
  created_at: string;
  updated_at: string;
};

export type TechnicalCardsListParams = {
  sales_order_id?: number | string;
  status?: string;
  stage?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export type TechnicalCardStageCompletePayload = {
  performer_name?: string | null;
  scrap_qty?: string | number | null;
  rework_qty?: string | number | null;
  notes?: string | null;
  work_done?: string | null;
  duration_seconds?: number | null;
};

export type TechnicalCardStageStartPayload = {
  performer_name?: string | null;
};

export type TechnicalCardStageFactPayload = {
  performer_name?: string | null;
  work_done?: string | null;
  duration_seconds?: number | null;
  scrap_qty?: string | number | null;
  rework_qty?: string | number | null;
  notes?: string | null;
  work_center_id?: number | null;
  shop_stage_code?: string | null;
};

export type ApiTechnicalCardPreviewLine = {
  sales_order_item_id: number;
  position: number;
  snapshot_name: string;
  quantity: string | number;
  eligible: boolean;
  skip_reason: string | null;
  existing_card_id: number | null;
  existing_status: TechnicalCardStatus | string | null;
  would_create: boolean;
  would_revive: boolean;
  planned_unit_line_count: number | null;
};

export type ApiTechnicalCardPreview = {
  sales_order_id: number;
  order_number: string;
  lines: ApiTechnicalCardPreviewLine[];
  create_count: number;
  revive_count: number;
};

export type ApiTechnicalCardGenerateResult = {
  sales_order_id: number;
  created: ApiTechnicalCard[];
  revived: ApiTechnicalCard[];
  skipped: { sales_order_item_id: number; reason: string; existing_card_id?: number | null }[];
};

function apiBaseUrl(): string {
  return (
    process.env.SPORT_LEADS_API_URL ??
    process.env.NEXT_PUBLIC_SPORT_LEADS_API_URL ??
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
}

async function readError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | { detail?: string | { msg?: string }[] }
    | null;
  if (typeof payload?.detail === "string") return payload.detail;
  if (Array.isArray(payload?.detail) && payload.detail[0]?.msg) {
    return payload.detail[0].msg;
  }
  return `${fallback} (${response.status})`;
}

export async function fetchOrderTechnicalCardsPreview(
  orderId: number | string,
): Promise<ApiTechnicalCardPreview> {
  const response = await fetch(`${apiBaseUrl()}/orders/${orderId}/technical-cards/preview`, {
    method: "POST",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Preview failed"));
  }
  return (await response.json()) as ApiTechnicalCardPreview;
}

export async function fetchOrderTechnicalCards(
  orderId: number | string,
): Promise<ApiTechnicalCardListItem[]> {
  const response = await fetch(`${apiBaseUrl()}/orders/${orderId}/technical-cards`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "List failed"));
  }
  return (await response.json()) as ApiTechnicalCardListItem[];
}

export async function generateOrderTechnicalCards(
  orderId: number | string,
  salesOrderItemIds?: number[],
): Promise<ApiTechnicalCardGenerateResult> {
  const response = await fetch(`${apiBaseUrl()}/orders/${orderId}/technical-cards/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      salesOrderItemIds ? { sales_order_item_ids: salesOrderItemIds } : {},
    ),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Generate failed"));
  }
  return (await response.json()) as ApiTechnicalCardGenerateResult;
}

export async function fetchTechnicalCard(
  cardId: number | string,
): Promise<ApiTechnicalCard> {
  const response = await fetch(`${apiBaseUrl()}/technical-cards/${cardId}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Card not found"));
  }
  return (await response.json()) as ApiTechnicalCard;
}

function buildListQuery(params: TechnicalCardsListParams): string {
  const query = new URLSearchParams();
  if (params.sales_order_id != null && String(params.sales_order_id).trim()) {
    query.set("sales_order_id", String(params.sales_order_id));
  }
  if (params.status?.trim()) query.set("status", params.status.trim());
  if (params.stage?.trim()) query.set("stage", params.stage.trim());
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export async function fetchTechnicalCards(
  params: TechnicalCardsListParams = {},
): Promise<ApiTechnicalCardListItem[]> {
  const response = await fetch(
    `${apiBaseUrl()}/technical-cards${buildListQuery(params)}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "List failed"));
  }
  return (await response.json()) as ApiTechnicalCardListItem[];
}

async function postTechnicalCardAction<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method: "POST",
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Action failed"));
  }
  return (await response.json()) as T;
}

export async function startTechnicalCard(
  cardId: number | string,
): Promise<ApiTechnicalCard> {
  return postTechnicalCardAction<ApiTechnicalCard>(
    `/technical-cards/${cardId}/start`,
  );
}

export async function startTechnicalCardStage(
  cardId: number | string,
  stageOrder: number | string,
  payload: TechnicalCardStageStartPayload = {},
): Promise<ApiTechnicalCard> {
  return postTechnicalCardAction<ApiTechnicalCard>(
    `/technical-cards/${cardId}/stages/${stageOrder}/start`,
    payload,
  );
}

export async function completeTechnicalCardStage(
  cardId: number | string,
  stageOrder: number | string,
  payload: TechnicalCardStageCompletePayload = {},
): Promise<ApiTechnicalCard> {
  return postTechnicalCardAction<ApiTechnicalCard>(
    `/technical-cards/${cardId}/stages/${stageOrder}/complete`,
    payload,
  );
}

export async function rollbackTechnicalCardStage(
  cardId: number | string,
  stageOrder: number | string,
): Promise<ApiTechnicalCard> {
  return postTechnicalCardAction<ApiTechnicalCard>(
    `/technical-cards/${cardId}/stages/${stageOrder}/rollback`,
  );
}

export async function rollbackTechnicalCardStageKanban(
  cardId: number | string,
  stageOrder: number | string,
): Promise<ApiTechnicalCard> {
  return postTechnicalCardAction<ApiTechnicalCard>(
    `/technical-cards/${cardId}/stages/${stageOrder}/rollback-kanban`,
  );
}

export async function updateTechnicalCardStageFact(
  cardId: number | string,
  stageOrder: number | string,
  payload: TechnicalCardStageFactPayload,
): Promise<ApiTechnicalCard> {
  const response = await fetch(
    `${apiBaseUrl()}/technical-cards/${cardId}/stages/${stageOrder}/fact`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Stage fact update failed"));
  }
  return (await response.json()) as ApiTechnicalCard;
}

export async function assignTechnicalCardPlannedWorkCenter(
  cardId: number | string,
  stageOrder: number | string,
  workCenterId: number | null,
): Promise<ApiTechnicalCard> {
  const response = await fetch(
    `${apiBaseUrl()}/technical-cards/${cardId}/stages/${stageOrder}/planned-work-center`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ work_center_id: workCenterId }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Planned work center update failed"));
  }
  return (await response.json()) as ApiTechnicalCard;
}

export async function applyTechnicalCardRouting(
  cardId: number | string,
  routingTemplateId: number,
): Promise<ApiTechnicalCard> {
  return postTechnicalCardAction<ApiTechnicalCard>(
    `/technical-cards/${cardId}/apply-routing`,
    { routing_template_id: routingTemplateId },
  );
}

export async function replaceTechnicalCardComposition(
  cardId: number | string,
  lines: TechnicalCardCompositionLineWrite[],
): Promise<ApiTechnicalCard> {
  const response = await fetch(`${apiBaseUrl()}/technical-cards/${cardId}/composition`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lines }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Composition replace failed"));
  }
  return (await response.json()) as ApiTechnicalCard;
}

export async function importTechnicalCardUnitLines(
  cardId: number | string,
  lines: TechnicalCardUnitLineAggregateImportRow[],
): Promise<ApiTechnicalCard> {
  const response = await fetch(`${apiBaseUrl()}/technical-cards/${cardId}/unit-lines/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lines }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Unit-line import failed"));
  }
  return (await response.json()) as ApiTechnicalCard;
}

export async function importTechnicalCardUnitLinesFile(
  cardId: number | string,
  formData: FormData,
): Promise<ApiTechnicalCard> {
  const response = await fetch(`${apiBaseUrl()}/technical-cards/${cardId}/unit-lines/import-file`, {
    method: "POST",
    body: formData,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Unit-line file import failed"));
  }
  return (await response.json()) as ApiTechnicalCard;
}

export async function replaceTechnicalCardUnitLines(
  cardId: number | string,
  lines: TechnicalCardUnitLineWriteItem[],
): Promise<ApiTechnicalCard> {
  const response = await fetch(`${apiBaseUrl()}/technical-cards/${cardId}/unit-lines`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lines }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Unit-line replace failed"));
  }
  return (await response.json()) as ApiTechnicalCard;
}

export async function bulkUpdateTechnicalCardUnitLines(
  cardId: number | string,
  lines: TechnicalCardUnitLineBulkUpdateItem[],
): Promise<ApiTechnicalCard> {
  const response = await fetch(`${apiBaseUrl()}/technical-cards/${cardId}/unit-lines/bulk`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lines }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Unit-line bulk update failed"));
  }
  return (await response.json()) as ApiTechnicalCard;
}

/** Shop-path MATERIAL fact_qty write (`9.3.4` / `11.5`); not used by manager composition UI. */
export async function setTechnicalCardCompositionFactQty(
  cardId: number | string,
  lineId: number | string,
  factQty: string | number,
  shopStageCode?: string | null,
): Promise<ApiTechnicalCard> {
  const response = await fetch(
    `${apiBaseUrl()}/technical-cards/${cardId}/composition/${lineId}/fact-qty`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fact_qty: factQty,
        ...(shopStageCode ? { shop_stage_code: shopStageCode } : {}),
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Fact qty update failed"));
  }
  return (await response.json()) as ApiTechnicalCard;
}

/** Shop-path delete of one MATERIAL composition line. */
export async function deleteTechnicalCardCompositionLine(
  cardId: number | string,
  lineId: number | string,
  shopStageCode?: string | null,
): Promise<ApiTechnicalCard> {
  const query = new URLSearchParams();
  if (shopStageCode?.trim()) {
    query.set("shop_stage_code", shopStageCode.trim());
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await fetch(
    `${apiBaseUrl()}/technical-cards/${cardId}/composition/${lineId}${suffix}`,
    {
      method: "DELETE",
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Composition line delete failed"));
  }
  return (await response.json()) as ApiTechnicalCard;
}

/** Shop-path TechOperation volume write (`11.6`). */
export async function updateTechnicalCardOperationLineVolume(
  cardId: number | string,
  lineId: number | string,
  volume: string | number,
  shopStageCode?: string | null,
): Promise<ApiTechnicalCard> {
  const response = await fetch(
    `${apiBaseUrl()}/technical-cards/${cardId}/operation-lines/${lineId}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        volume,
        ...(shopStageCode ? { shop_stage_code: shopStageCode } : {}),
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Operation volume update failed"));
  }
  return (await response.json()) as ApiTechnicalCard;
}

/** Resolve media content URL against the same-origin Next proxy (`26.8.1`). */
export function technicalCardMediaContentUrl(
  url: string | null | undefined,
): string | null {
  return sameOriginApiMediaUrl(url);
}

export async function uploadTechnicalCardMedia(
  cardId: number | string,
  payload: TechnicalCardMediaUploadPayload,
): Promise<ApiTechnicalCardMedia> {
  const response = await fetch(`${apiBaseUrl()}/technical-cards/${cardId}/media`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      filename: payload.filename,
      mime_type: payload.mime_type,
      content_base64: payload.content_base64,
      is_primary: payload.is_primary ?? false,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Upload failed"));
  }
  return (await response.json()) as ApiTechnicalCardMedia;
}

export async function setTechnicalCardMediaPrimary(
  cardId: number | string,
  mediaId: number | string,
): Promise<ApiTechnicalCardMedia> {
  const response = await fetch(
    `${apiBaseUrl()}/technical-cards/${cardId}/media/${mediaId}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_primary: true }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Set primary failed"));
  }
  return (await response.json()) as ApiTechnicalCardMedia;
}

export async function deleteTechnicalCardMedia(
  cardId: number | string,
  mediaId: number | string,
): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl()}/technical-cards/${cardId}/media/${mediaId}`,
    {
      method: "DELETE",
      cache: "no-store",
    },
  );
  if (!response.ok && response.status !== 204) {
    throw new Error(await readError(response, "Delete failed"));
  }
}
