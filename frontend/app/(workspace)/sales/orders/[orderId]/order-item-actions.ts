"use server";

import { revalidatePath } from "next/cache";

const apiBaseUrl = () => (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

async function callItems(orderId: string, path: string, method: string, body?: Record<string, unknown>) {
  const response = await fetch(`${apiBaseUrl()}/orders/${orderId}/items${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null;
    return { ok: false, message: payload?.detail ?? `Backend вернул ${response.status}.` };
  }
  revalidatePath(`/sales/orders/${orderId}`);
  return { ok: true, message: "Позиции заказа сохранены." };
}

export async function createOrderItem(orderId: string, formData: FormData) {
  return callItems(orderId, "", "POST", {
    name: String(formData.get("name") ?? ""),
    unit: String(formData.get("unit") ?? "шт"),
    quantity: String(formData.get("quantity") ?? "0"),
    unit_price: String(formData.get("unit_price") ?? "0"),
  });
}

export async function updateOrderItem(orderId: string, itemId: number, formData: FormData) {
  return callItems(orderId, `/${itemId}`, "PATCH", {
    name: String(formData.get("name") ?? ""),
    unit: String(formData.get("unit") ?? "шт"),
    quantity: String(formData.get("quantity") ?? "0"),
    unit_price: String(formData.get("unit_price") ?? "0"),
  });
}

export async function deleteOrderItem(orderId: string, itemId: number) {
  return callItems(orderId, `/${itemId}`, "DELETE");
}
