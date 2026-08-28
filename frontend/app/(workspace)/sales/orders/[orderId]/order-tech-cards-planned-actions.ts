"use server";

import { revalidatePath } from "next/cache";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import { fromApiSalesOrder, type SalesOrderDetails } from "@/lib/sales/order-details";

const apiBaseUrl = () =>
  (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export type SaveOrderTechCardsPlannedResult =
  | { ok: true; order: SalesOrderDetails }
  | { ok: false; message: string };

export async function saveOrderTechCardsPlannedCount(
  orderId: string,
  plannedCount: number | null,
): Promise<SaveOrderTechCardsPlannedResult> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/orders/${orderId}/tech-cards-planned-count`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({ tech_cards_planned_count: plannedCount }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: string | Array<{ msg?: string }> }
      | null;
    const detail =
      typeof payload?.detail === "string"
        ? payload.detail
        : Array.isArray(payload?.detail) && payload.detail[0]?.msg
          ? String(payload.detail[0].msg)
          : `Не удалось сохранить плановое количество ТК (${response.status})`;
    return { ok: false, message: detail };
  }
  revalidatePath(`/sales/orders/${orderId}`);
  revalidatePath("/production/tech-cards");
  return {
    ok: true,
    order: fromApiSalesOrder(await response.json()),
  };
}
