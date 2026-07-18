import type { OrderStatus } from "@/types/sales";

export type ApiSalesOrderDetails = {
  id: number;
  number: string;
  lead_id: number;
  client_id: number;
  organization_id: number | null;
  organization_name: string | null;
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
  items: ApiSalesOrderItem[];
};

export type ApiSalesOrderItem = {
  id: number;
  order_id: number;
  position: number;
  snapshot_name: string;
  size_range: string | null;
  personalization: string | null;
  color: string | null;
  unit: string;
  quantity: number | string;
  unit_price: number | string;
  gross_amount: number | string;
  discount_percent: number | string | null;
  discount_amount: number | string;
  line_amount: number | string;
  created_at: string;
  updated_at: string;
};

export type ApiSalesOrderEvent = {
  id: number;
  event_type: "lead_converted" | "order_created" | "order_status_changed";
  actor_id: number | null;
  message: string | null;
  created_at: string;
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
  organizationName: string;
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
  items: SalesOrderItem[];
};

export type SalesOrderItem = {
  id: number;
  snapshotName: string;
  sizeRange: string;
  personalization: string;
  color: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  grossAmount: string;
  discountPercent: string;
  discountAmount: string;
  lineAmount: string;
};

export type SalesOrderHistoryItem = {
  id: string;
  title: string;
  message: string;
  occurredAt: string;
};

const historyTitles: Record<ApiSalesOrderEvent["event_type"], string> = {
  lead_converted: "Лид конвертирован",
  order_created: "Заказ создан",
  order_status_changed: "Статус заказа изменён",
};

export function fromApiSalesOrderEvent(event: ApiSalesOrderEvent): SalesOrderHistoryItem {
  return {
    id: `order-event-${event.id}`,
    title: historyTitles[event.event_type],
    message: event.message ?? "Изменение сохранено в истории заказа.",
    occurredAt: event.created_at,
  };
}

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
    organizationName: order.organization_name ?? "Организация не назначена",
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
    items: (order.items ?? []).map((item) => ({
      id: item.id,
      snapshotName: item.snapshot_name,
      sizeRange: item.size_range ?? "",
      personalization: item.personalization ?? "",
      color: item.color ?? "",
      unit: item.unit,
      quantity: String(item.quantity),
      unitPrice: currencyFormatter.format(Number(item.unit_price)),
      grossAmount: currencyFormatter.format(Number(item.gross_amount)),
      discountPercent: item.discount_percent === null ? "" : String(item.discount_percent),
      discountAmount: currencyFormatter.format(Number(item.discount_amount)),
      lineAmount: currencyFormatter.format(Number(item.line_amount)),
    })),
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

export type OrderHistoryResult =
  | { kind: "found"; history: SalesOrderHistoryItem[] }
  | { kind: "not-found" }
  | { kind: "error"; message: string };

export async function getOrderHistory(orderId: string): Promise<OrderHistoryResult> {
  if (!/^\d+$/.test(orderId)) return { kind: "not-found" };
  const apiUrl = process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/orders/${orderId}/history`, { cache: "no-store" });
  if (response.status === 404) return { kind: "not-found" };
  if (!response.ok) {
    return { kind: "error", message: `Не удалось загрузить историю заказа из backend (${response.status}).` };
  }
  const events = await response.json() as ApiSalesOrderEvent[];
  return { kind: "found", history: events.map(fromApiSalesOrderEvent) };
}
