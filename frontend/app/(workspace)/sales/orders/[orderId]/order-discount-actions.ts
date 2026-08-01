"use server";

import { revalidatePath } from "next/cache";

import { parseOrderDiscountPercentInput } from "@/lib/sales/order-discount";

export type OrderDiscountActionResult =
  | {
      ok: true;
      order: {
        amount: string | number | null;
        discount_percent: string | number | null;
        discount_amount: string | number;
        items_subtotal: string | number | null;
      };
    }
  | { ok: false; message: string };

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export async function updateOrderDiscount(
  orderId: string,
  discountPercentRaw: string,
): Promise<OrderDiscountActionResult> {
  if (!/^\d+$/.test(orderId)) {
    return { ok: false, message: "Некорректный идентификатор заказа" };
  }
  const parsed = parseOrderDiscountPercentInput(discountPercentRaw);
  if (!parsed.ok) {
    return { ok: false, message: parsed.message };
  }

  try {
    const response = await fetch(`${apiBaseUrl()}/orders/${orderId}/discount`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discount_percent: parsed.value }),
      cache: "no-store",
    });
    if (!response.ok) {
      let message = `Ошибка API (${response.status})`;
      try {
        const body = (await response.json()) as { detail?: string | unknown };
        if (typeof body.detail === "string" && body.detail.trim()) {
          message = body.detail;
        }
      } catch {
        /* ignore */
      }
      return { ok: false, message };
    }
    const order = (await response.json()) as {
      amount: string | number | null;
      discount_percent: string | number | null;
      discount_amount: string | number;
      items_subtotal: string | number | null;
    };
    revalidatePath(`/sales/orders/${orderId}`);
    return {
      ok: true,
      order: {
        amount: order.amount,
        discount_percent: order.discount_percent,
        discount_amount: order.discount_amount,
        items_subtotal: order.items_subtotal,
      },
    };
  } catch {
    return { ok: false, message: "Не удалось связаться с API" };
  }
}
