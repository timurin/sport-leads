import type { OrderStatus } from "@/types/sales";

export type ApiSalesOrderDetails = {
  id: number;
  number: string;
  lead_id: number;
  client_id: number;
  status: OrderStatus;
  responsible_id: number | null;
  responsible_name: string | null;
  client_name: string | null;
  title: string;
  description: string | null;
  product_category: string | null;
  sport: string | null;
  quantity: number | null;
  amount: number | string | null;
  desired_date: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
};

const statusLabels: Record<OrderStatus, string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  production: "В производстве",
  ready: "Готов",
  shipped: "Отгружен",
  completed: "Завершён",
  cancelled: "Отменён",
};

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export type SalesOrderDetails = {
  id: string;
  number: string;
  title: string;
  status: string;
  clientName: string;
  responsibleName: string;
  amount: string;
  createdAt: string;
  desiredDate: string;
  source: string;
  sourceLeadHref: string;
  description: string;
  productCategory: string;
  sport: string;
  quantity: string;
};

function formatDate(value: string | null): string {
  if (!value) return "Не указана";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? "Не указана" : dateFormatter.format(date);
}

export function fromApiSalesOrder(order: ApiSalesOrderDetails): SalesOrderDetails {
  const amount = order.amount === null ? "Не указана" : currencyFormatter.format(Number(order.amount));
  return {
    id: String(order.id),
    number: order.number,
    title: order.title || "Заказ без наименования",
    status: statusLabels[order.status],
    clientName: order.client_name ?? `Клиент #${order.client_id}`,
    responsibleName: order.responsible_name ?? (order.responsible_id === null ? "Не назначен" : `Сотрудник #${order.responsible_id}`),
    amount: Number.isFinite(Number(order.amount)) ? amount : "Не указана",
    createdAt: formatDate(order.created_at),
    desiredDate: formatDate(order.desired_date),
    source: order.source ?? "Не указан",
    sourceLeadHref: `/sales/leads/${order.lead_id}`,
    description: order.description ?? "Описание пока не добавлено.",
    productCategory: order.product_category ?? "Не указана",
    sport: order.sport ?? "Не указан",
    quantity: order.quantity === null ? "Не указано" : `${order.quantity} ед.`,
  };
}

export type OrderDetailsResult =
  | { kind: "found"; order: SalesOrderDetails }
  | { kind: "not-found" }
  | { kind: "error"; message: string };

export async function getOrderDetails(orderId: string): Promise<OrderDetailsResult> {
  if (!/^\d+$/.test(orderId)) return { kind: "not-found" };
  const apiUrl = process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/orders/${orderId}`, { cache: "no-store" });
  if (response.status === 404) return { kind: "not-found" };
  if (!response.ok) {
    return { kind: "error", message: `Не удалось загрузить заказ из backend (${response.status}).` };
  }
  return { kind: "found", order: fromApiSalesOrder(await response.json() as ApiSalesOrderDetails) };
}
