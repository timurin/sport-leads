"use server";

import { revalidatePath } from "next/cache";

const apiBaseUrl = () =>
  (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export type CommercialDocStatus = "draft" | "issued" | "cancelled";

export type CommercialLine = {
  id: number;
  source_order_item_id: number | null;
  position: number;
  snapshot_name: string;
  unit: string;
  quantity: string | number;
  unit_price: string | number;
  discount_percent: string | number | null;
  discount_amount: string | number;
  line_amount: string | number;
  vat_rate_id: number | null;
  vat_rate_percent: string | number | null;
  price_includes_vat: boolean;
  vat_amount: string | number;
  line_total: string | number;
};

export type SalesQuotation = {
  id: number;
  number: string;
  sales_order_id: number;
  status: CommercialDocStatus;
  currency_code: string;
  discount_percent: string | number | null;
  discount_amount: string | number;
  vat_amount: string | number;
  amount: string | number;
  amount_net: string | number;
  created_at: string;
  updated_at: string;
  items: CommercialLine[];
};

export type SalesInvoice = {
  id: number;
  number: string;
  sales_order_id: number;
  quotation_id: number | null;
  status: CommercialDocStatus;
  currency_code: string;
  discount_percent: string | number | null;
  discount_amount: string | number;
  vat_amount: string | number;
  amount: string | number;
  amount_net: string | number;
  created_at: string;
  updated_at: string;
  items: CommercialLine[];
};

export type PrintFormRender = {
  print_form_id: number;
  print_form_code: string;
  version_id: number;
  version_no: number;
  output_format: string;
  content_type: string;
  file_name: string;
  content: string;
  is_preview: boolean;
};

async function callCommercial(
  orderId: string,
  path: string,
  method: string,
  body?: Record<string, unknown>,
) {
  const response = await fetch(`${apiBaseUrl()}/orders/${orderId}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    return {
      ok: false as const,
      message: payload?.detail ?? `Backend вернул ${response.status}.`,
      data: null,
    };
  }
  const data = method === "DELETE" ? null : await response.json();
  revalidatePath(`/sales/orders/${orderId}`);
  return { ok: true as const, message: "Документ сохранён.", data };
}

export async function listOrderQuotations(orderId: string): Promise<SalesQuotation[]> {
  const response = await fetch(`${apiBaseUrl()}/orders/${orderId}/quotations`, {
    cache: "no-store",
  });
  if (!response.ok) return [];
  return (await response.json()) as SalesQuotation[];
}

export async function listOrderInvoices(orderId: string): Promise<SalesInvoice[]> {
  const response = await fetch(`${apiBaseUrl()}/orders/${orderId}/invoices`, {
    cache: "no-store",
  });
  if (!response.ok) return [];
  return (await response.json()) as SalesInvoice[];
}

export async function createOrderQuotation(orderId: string) {
  return callCommercial(orderId, "/quotations", "POST");
}

export async function createOrderInvoice(orderId: string, quotationId?: number | null) {
  return callCommercial(orderId, "/invoices", "POST", {
    quotation_id: quotationId ?? null,
  });
}

export async function generatePrintForm(request: {
  binding_type: "model";
  binding_key: "sales_order" | "sales_quotation" | "sales_invoice";
  output_format: "html";
  payload: Record<string, unknown>;
}) {
  const response = await fetch(`${apiBaseUrl()}/print-forms/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    return {
      ok: false as const,
      message:
        payload?.detail
        ?? `Не удалось сформировать печатную форму (${response.status}).`,
      render: null,
    };
  }
  return {
    ok: true as const,
    message: "Печатная форма сформирована.",
    render: (await response.json()) as PrintFormRender,
  };
}
