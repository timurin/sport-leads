import "server-only";

import { readApiDetail, sessionRequestHeaders } from "@/lib/auth/api-headers";
import {
  fromApiSalesOrders,
  type ApiSalesOrder,
  type CreateSalesOrderPayload,
  type CreateSalesOrderResult,
  type OrderListResult,
  type OrderStatusUpdateResult,
} from "@/lib/sales/order-list-api";
import type { OrderStatus } from "@/types/sales";

function apiBaseUrl() {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

export async function getOrderList(): Promise<OrderListResult> {
  try {
    const response = await fetch(`${apiBaseUrl()}/orders?limit=500`, {
      cache: "no-store",
      headers: await sessionRequestHeaders(),
    });
    if (!response.ok) {
      return {
        ok: false,
        message: await readApiDetail(
          response,
          `Не удалось загрузить заказы из backend (${response.status}).`,
        ),
      };
    }
    const orders = (await response.json()) as ApiSalesOrder[];
    return { ok: true, orders, columns: fromApiSalesOrders(orders) };
  } catch {
    return {
      ok: false,
      message: "Не удалось связаться с backend. Список заказов не подставлен из demo.",
    };
  }
}

export async function updateApiOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<OrderStatusUpdateResult> {
  const response = await fetch(`${apiBaseUrl()}/orders/${orderId}/status`, {
    method: "PATCH",
    headers: await sessionRequestHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ status }),
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      ok: false,
      message: await readApiDetail(
        response,
        `Backend не сохранил статус заказа (${response.status}).`,
      ),
    };
  }

  return { ok: true, order: (await response.json()) as ApiSalesOrder };
}

export async function createApiSalesOrder(
  payload: CreateSalesOrderPayload,
): Promise<CreateSalesOrderResult> {
  const response = await fetch(`${apiBaseUrl()}/orders`, {
    method: "POST",
    headers: await sessionRequestHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      ok: false,
      message: await readApiDetail(response, `Backend не создал заказ (${response.status}).`),
    };
  }

  return { ok: true, order: (await response.json()) as ApiSalesOrder };
}
