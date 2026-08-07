/**
 * Stock documents client for `/warehouse/movements` (`12.3.3` / ADR-019).
 */

export type StockDocumentType =
  | "receipt"
  | "issue"
  | "fg_receipt"
  | "fg_issue";

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
