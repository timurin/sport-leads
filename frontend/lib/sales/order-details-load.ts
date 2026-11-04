import "server-only";

import { readApiDetail, sessionRequestHeaders } from "@/lib/auth/api-headers";
import {
  fromApiSalesOrder,
  fromApiSalesOrderEvent,
  type ApiSalesOrderDetails,
  type ApiSalesOrderEvent,
  type SalesOrderDetails,
  type SalesOrderHistoryItem,
} from "@/lib/sales/order-details";

export type OrderDetailsResult =
  | { kind: "found"; order: SalesOrderDetails }
  | { kind: "not-found" }
  | { kind: "error"; message: string };

export type OrderHistoryResult =
  | { kind: "found"; events: ApiSalesOrderEvent[]; history: SalesOrderHistoryItem[] }
  | { kind: "not-found" }
  | { kind: "error"; message: string };

function apiBaseUrl() {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

export async function getOrderDetails(orderId: string): Promise<OrderDetailsResult> {
  if (!/^\d+$/.test(orderId)) return { kind: "not-found" };
  const response = await fetch(`${apiBaseUrl()}/orders/${orderId}`, {
    cache: "no-store",
    headers: await sessionRequestHeaders(),
  });
  if (response.status === 404) return { kind: "not-found" };
  if (!response.ok) {
    return {
      kind: "error",
      message: await readApiDetail(
        response,
        `Не удалось загрузить заказ из backend (${response.status}).`,
      ),
    };
  }
  return { kind: "found", order: fromApiSalesOrder((await response.json()) as ApiSalesOrderDetails) };
}

export async function getOrderHistory(orderId: string): Promise<OrderHistoryResult> {
  if (!/^\d+$/.test(orderId)) return { kind: "not-found" };
  const response = await fetch(`${apiBaseUrl()}/orders/${orderId}/history`, {
    cache: "no-store",
    headers: await sessionRequestHeaders(),
  });
  if (response.status === 404) return { kind: "not-found" };
  if (!response.ok) {
    return {
      kind: "error",
      message: await readApiDetail(
        response,
        `Не удалось загрузить историю заказа из backend (${response.status}).`,
      ),
    };
  }
  const events = (await response.json()) as ApiSalesOrderEvent[];
  return {
    kind: "found",
    events,
    history: events.map(fromApiSalesOrderEvent),
  };
}
