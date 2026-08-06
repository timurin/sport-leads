"use server";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import { fromApiSalesOrder, type SalesOrderDetails } from "@/lib/sales/order-details";

const apiBaseUrl = () =>
  (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export type OrderClientNeedInput = {
  description?: string | null;
  productCategory?: string | null;
  sport?: string | null;
  quantity?: number | null;
  desiredDate?: string | null;
  source?: string | null;
  syncToLead?: boolean;
};

export type SaveOrderClientNeedResult =
  | { ok: true; order: SalesOrderDetails }
  | { ok: false; message: string };

export async function saveOrderClientNeed(
  orderId: string,
  input: OrderClientNeedInput,
): Promise<SaveOrderClientNeedResult> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/orders/${orderId}/client-need`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({
      description: input.description ?? null,
      product_category: input.productCategory ?? null,
      sport: input.sport ?? null,
      quantity: input.quantity ?? null,
      desired_date: input.desiredDate || null,
      source: input.source ?? null,
      sync_to_lead: input.syncToLead !== false,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: string | Array<{ msg?: string }> }
      | null;
    const detail =
      typeof payload?.detail === "string"
        ? payload.detail
        : Array.isArray(payload?.detail) && payload.detail[0]?.msg
          ? String(payload.detail[0].msg)
          : `Не удалось сохранить потребность (${response.status})`;
    return { ok: false, message: detail };
  }
  return {
    ok: true,
    order: fromApiSalesOrder(await response.json()),
  };
}
