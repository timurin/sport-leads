"use server";

import { revalidatePath } from "next/cache";

const apiBaseUrl = () =>
  (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export type OrderPaymentStatus = "unpaid" | "partial" | "paid";

export type MaterialReserveStatus = "not_required" | "pending" | "reserved";

async function readDetail(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
  return payload?.detail ?? `Backend вернул ${response.status}.`;
}

export async function updateOrderPayment(
  orderId: string,
  payload: { paymentStatus?: OrderPaymentStatus; paidAmount?: string },
) {
  const body: Record<string, string | number> = {};
  if (payload.paymentStatus) body.payment_status = payload.paymentStatus;
  if (payload.paidAmount !== undefined && payload.paidAmount.trim() !== "") {
    const amount = Number(String(payload.paidAmount).replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) {
      return { ok: false as const, message: "Сумма оплаты должна быть числом ≥ 0." };
    }
    body.paid_amount = amount;
  }
  if (!("payment_status" in body) && !("paid_amount" in body)) {
    return { ok: false as const, message: "Укажите статус или сумму оплаты." };
  }

  const response = await fetch(`${apiBaseUrl()}/orders/${orderId}/payment`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false as const, message: await readDetail(response) };
  }
  revalidatePath(`/sales/orders/${orderId}`);
  return { ok: true as const, message: "Оплата обновлена." };
}

export async function updateOrderMaterialReserve(
  orderId: string,
  materialReserveStatus: MaterialReserveStatus,
) {
  const response = await fetch(`${apiBaseUrl()}/orders/${orderId}/material-reserve`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ material_reserve_status: materialReserveStatus }),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false as const, message: await readDetail(response) };
  }
  revalidatePath(`/sales/orders/${orderId}`);
  return { ok: true as const, message: "Резерв материалов обновлён." };
}
