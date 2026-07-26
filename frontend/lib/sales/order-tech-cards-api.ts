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
  quantity: string | number | null;
  unit: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiTechnicalCardUnitLine = {
  id: number;
  technical_card_id: number;
  unit_index: number;
  size?: string | null;
  personalization?: string | null;
  print_number?: string | null;
  color?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ApiTechnicalCardOperationLine = {
  id: number;
  technical_card_id: number;
  sequence: number;
  tech_operation_id: number | null;
  operation_name: string;
  volume_unit: TechnicalCardVolumeUnit | string;
  volume: string | number;
  stage_order: number | null;
  stage_label: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiTechnicalCardStageResult = {
  id: number;
  technical_card_id: number;
  stage_order: number;
  stage_label: string;
  status: TechnicalCardStageResultStatus | string;
  performer_name: string | null;
  started_at: string | null;
  completed_at: string | null;
  scrap_qty: string | number | null;
  rework_qty: string | number | null;
  notes: string | null;
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
  composition_lines?: ApiTechnicalCardCompositionLine[];
  unit_lines: ApiTechnicalCardUnitLine[];
  operation_lines?: ApiTechnicalCardOperationLine[];
  stage_results?: ApiTechnicalCardStageResult[];
  created_at: string;
  updated_at: string;
};

export type ApiTechnicalCardListItem = ApiTechnicalCard & {
  order_number: string | null;
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
};

export type TechnicalCardStageStartPayload = {
  performer_name?: string | null;
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
): Promise<ApiTechnicalCard[]> {
  const response = await fetch(`${apiBaseUrl()}/orders/${orderId}/technical-cards`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "List failed"));
  }
  return (await response.json()) as ApiTechnicalCard[];
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
