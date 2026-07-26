"use server";

import { revalidatePath } from "next/cache";

const apiBaseUrl = () => (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export type OrderItemPayload = {
  nomenclature_id?: number | null;
  nomenclature_variant_id?: number | null;
  product_model_id?: number | null;
  product_model_article?: string | null;
  product_model_name?: string | null;
  vat_rate_id?: number | null;
  snapshot_name: string;
  size_range?: string | null;
  personalization?: string | null;
  color?: string | null;
  unit?: string;
  quantity: string;
  unit_price: string;
  discount_percent?: string | null;
};

async function callItems(
  orderId: string,
  path: string,
  method: string,
  body?: Record<string, unknown>,
) {
  const response = await fetch(`${apiBaseUrl()}/orders/${orderId}/items${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null;
    return { ok: false as const, message: payload?.detail ?? `Backend вернул ${response.status}.` };
  }
  revalidatePath(`/sales/orders/${orderId}`);
  return { ok: true as const, message: "Позиции заказа сохранены." };
}

function toBody(payload: OrderItemPayload): Record<string, unknown> {
  return {
    nomenclature_id: payload.nomenclature_id ?? null,
    nomenclature_variant_id: payload.nomenclature_variant_id ?? null,
    product_model_id: payload.product_model_id ?? null,
    product_model_article: payload.product_model_article ?? null,
    product_model_name: payload.product_model_name ?? null,
    vat_rate_id: payload.vat_rate_id ?? null,
    snapshot_name: payload.snapshot_name,
    size_range: payload.size_range ?? null,
    personalization: payload.personalization ?? null,
    color: payload.color ?? null,
    unit: payload.unit ?? "шт",
    quantity: payload.quantity,
    unit_price: payload.unit_price,
    discount_percent: payload.discount_percent ?? null,
  };
}

export async function createOrderItem(orderId: string, formData: FormData) {
  return callItems(orderId, "", "POST", {
    nomenclature_id: formData.get("nomenclature_id") ? Number(formData.get("nomenclature_id")) : null,
    nomenclature_variant_id: formData.get("nomenclature_variant_id") ? Number(formData.get("nomenclature_variant_id")) : null,
    product_model_id: formData.get("product_model_id") ? Number(formData.get("product_model_id")) : null,
    product_model_article: String(formData.get("product_model_article") ?? "").trim() || null,
    product_model_name: String(formData.get("product_model_name") ?? "").trim() || null,
    vat_rate_id: formData.get("vat_rate_id") ? Number(formData.get("vat_rate_id")) : null,
    snapshot_name: String(formData.get("snapshot_name") ?? ""),
    size_range: String(formData.get("size_range") ?? "").trim() || null,
    personalization: String(formData.get("personalization") ?? "").trim() || null,
    color: String(formData.get("color") ?? "").trim() || null,
    unit: String(formData.get("unit") ?? "шт"),
    quantity: String(formData.get("quantity") ?? "0"),
    unit_price: String(formData.get("unit_price") ?? "0"),
    discount_percent: String(formData.get("discount_percent") ?? "").trim() || null,
  });
}

export async function createOrderItemPayload(orderId: string, payload: OrderItemPayload) {
  return callItems(orderId, "", "POST", toBody(payload));
}

export async function updateOrderItem(orderId: string, itemId: number, formData: FormData) {
  return callItems(orderId, `/${itemId}`, "PATCH", {
    nomenclature_id: formData.get("nomenclature_id") ? Number(formData.get("nomenclature_id")) : null,
    nomenclature_variant_id: formData.get("nomenclature_variant_id") ? Number(formData.get("nomenclature_variant_id")) : null,
    product_model_id: formData.get("product_model_id") ? Number(formData.get("product_model_id")) : null,
    product_model_article: String(formData.get("product_model_article") ?? "").trim() || null,
    product_model_name: String(formData.get("product_model_name") ?? "").trim() || null,
    vat_rate_id: formData.get("vat_rate_id") ? Number(formData.get("vat_rate_id")) : null,
    snapshot_name: String(formData.get("snapshot_name") ?? ""),
    size_range: String(formData.get("size_range") ?? "").trim() || null,
    personalization: String(formData.get("personalization") ?? "").trim() || null,
    color: String(formData.get("color") ?? "").trim() || null,
    unit: String(formData.get("unit") ?? "шт"),
    quantity: String(formData.get("quantity") ?? "0"),
    unit_price: String(formData.get("unit_price") ?? "0"),
    discount_percent: String(formData.get("discount_percent") ?? "").trim() || null,
  });
}

export async function updateOrderItemPayload(
  orderId: string,
  itemId: number,
  payload: OrderItemPayload,
) {
  return callItems(orderId, `/${itemId}`, "PATCH", toBody(payload));
}

export async function deleteOrderItem(orderId: string, itemId: number) {
  return callItems(orderId, `/${itemId}`, "DELETE");
}
