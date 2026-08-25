/**
 * Stock documents client for `/warehouse/movements` (`12.3.3` / ADR-019).
 */

export type StockDocumentType =
  | "receipt"
  | "issue"
  | "fg_receipt"
  | "fg_issue"
  | "inventory";

export type StockDocumentStatus = "draft" | "posted" | "cancelled";

export type StockLedgerLine = {
  id: number;
  line_no: number;
  warehouse_id: number;
  nomenclature_id: number;
  nomenclature_name?: string | null;
  quantity: string | number;
  posted_at: string | null;
  technical_card_id: number | null;
  sales_order_id: number | null;
};

export type StockInventoryLine = {
  id: number;
  sequence: number;
  nomenclature_id: number;
  nomenclature_name?: string | null;
  book_qty: string | number;
  counted_qty: string | number;
  delta: string | number;
};

export type StockDocument = {
  id: number;
  number: string;
  doc_type: StockDocumentType | string;
  status: StockDocumentStatus | string;
  warehouse_id: number;
  posted_at: string | null;
  technical_card_id: number | null;
  sales_order_id: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  ledger_lines: StockLedgerLine[];
  inventory_lines?: StockInventoryLine[];
};

export type StockDocumentListParams = {
  doc_type?: string;
  status?: string;
  warehouse_id?: number;
  technical_card_id?: number;
  sales_order_id?: number;
  limit?: number;
  offset?: number;
};

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export function stockDocumentTypeLabel(docType: string): string {
  switch (docType) {
    case "receipt":
      return "Приход";
    case "issue":
      return "Списание";
    case "fg_receipt":
      return "Приход ГП";
    case "fg_issue":
      return "Списание ГП";
    case "inventory":
      return "Инвентаризация";
    default:
      return docType;
  }
}

export function stockDocumentStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Черновик";
    case "posted":
      return "Проведён";
    case "cancelled":
      return "Отменён";
    default:
      return status;
  }
}

export function stockDocumentStatusTone(
  status: string,
): "neutral" | "success" | "warning" | "danger" {
  switch (status) {
    case "posted":
      return "success";
    case "draft":
      return "warning";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

export function formatStockDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function isInventoryDocument(row: { doc_type: string }): boolean {
  return row.doc_type === "inventory";
}

export function inventoryLineDelta(
  bookQty: string | number,
  countedQty: string | number,
): string {
  const book = Number(bookQty);
  const counted = Number(countedQty);
  if (!Number.isFinite(book) || !Number.isFinite(counted)) {
    return "—";
  }
  return formatStockQuantity(counted - book);
}

export function formatStockQuantity(value: string | number): string {
  const asNumber = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(asNumber)) return String(value);
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 3,
  }).format(asNumber);
}

export function filterStockDocumentsClient(
  rows: StockDocument[],
  query: string,
): StockDocument[] {
  const needle = query.trim().toLocaleLowerCase("ru");
  if (!needle) return rows;
  return rows.filter((row) => {
    const haystack = [
      row.number,
      row.doc_type,
      stockDocumentTypeLabel(row.doc_type),
      row.status,
      stockDocumentStatusLabel(row.status),
      row.technical_card_id != null ? String(row.technical_card_id) : "",
      row.sales_order_id != null ? String(row.sales_order_id) : "",
      row.notes ?? "",
    ]
      .join(" ")
      .toLocaleLowerCase("ru");
    return haystack.includes(needle);
  });
}

export async function listStockDocuments(
  params: StockDocumentListParams = {},
): Promise<StockDocument[]> {
  const query = new URLSearchParams();
  if (params.doc_type) query.set("doc_type", params.doc_type);
  if (params.status) query.set("status", params.status);
  if (params.warehouse_id != null) {
    query.set("warehouse_id", String(params.warehouse_id));
  }
  if (params.technical_card_id != null) {
    query.set("technical_card_id", String(params.technical_card_id));
  }
  if (params.sales_order_id != null) {
    query.set("sales_order_id", String(params.sales_order_id));
  }
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await fetch(`${apiBaseUrl()}/stock/documents${suffix}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `Не удалось загрузить складские документы (${response.status}).`,
    );
  }
  return (await response.json()) as StockDocument[];
}

export async function getStockDocument(
  documentId: number,
): Promise<StockDocument | null> {
  const response = await fetch(
    `${apiBaseUrl()}/stock/documents/${documentId}`,
    { cache: "no-store" },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      `Не удалось загрузить складской документ (${response.status}).`,
    );
  }
  return (await response.json()) as StockDocument;
}

async function readStockApiError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string | unknown };
    if (typeof body.detail === "string" && body.detail.trim()) {
      return body.detail;
    }
    if (Array.isArray(body.detail) && body.detail.length > 0) {
      const first = body.detail[0] as { msg?: string };
      if (typeof first?.msg === "string" && first.msg.trim()) {
        return first.msg;
      }
    }
  } catch {
    /* ignore */
  }
  return `${fallback} (${response.status})`;
}

export type InventoryDocumentCreatePayload = {
  warehouse_id: number;
  notes?: string | null;
  fill?: boolean;
};

export async function createInventoryDocument(
  payload: InventoryDocumentCreatePayload,
): Promise<StockDocument> {
  const response = await fetch(`${apiBaseUrl()}/stock/inventory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      warehouse_id: payload.warehouse_id,
      notes: payload.notes ?? null,
      fill: payload.fill ?? true,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      await readStockApiError(response, "Не удалось создать инвентаризацию"),
    );
  }
  return (await response.json()) as StockDocument;
}

export async function fillInventoryDocument(
  documentId: number,
): Promise<StockDocument> {
  const response = await fetch(
    `${apiBaseUrl()}/stock/inventory/${documentId}/fill`,
    { method: "POST", cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(
      await readStockApiError(response, "Не удалось заполнить инвентаризацию"),
    );
  }
  return (await response.json()) as StockDocument;
}

export async function refreshInventoryBook(
  documentId: number,
): Promise<StockDocument> {
  const response = await fetch(
    `${apiBaseUrl()}/stock/inventory/${documentId}/refresh`,
    { method: "POST", cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(
      await readStockApiError(response, "Не удалось обновить книгу"),
    );
  }
  return (await response.json()) as StockDocument;
}

export async function setInventoryCounted(
  documentId: number,
  nomenclatureId: number,
  countedQty: string,
): Promise<StockDocument> {
  const response = await fetch(
    `${apiBaseUrl()}/stock/inventory/${documentId}/counted`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nomenclature_id: nomenclatureId,
        counted_qty: countedQty,
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(
      await readStockApiError(response, "Не удалось сохранить факт"),
    );
  }
  return (await response.json()) as StockDocument;
}

export async function postInventoryDocument(
  documentId: number,
): Promise<StockDocument> {
  const response = await fetch(
    `${apiBaseUrl()}/stock/inventory/${documentId}/post`,
    { method: "POST", cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(
      await readStockApiError(response, "Не удалось провести инвентаризацию"),
    );
  }
  return (await response.json()) as StockDocument;
}

