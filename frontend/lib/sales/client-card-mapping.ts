import { fromApiClientListItem, type ApiClientListItem } from "./client-list-mapping.ts";
import type { Client, OrderStatus } from "@/types/sales";

export type ApiClientOrderSummary = {
  id: number;
  number: string;
  title: string;
  status: OrderStatus;
  amount: number | string | null;
  sport: string | null;
  created_at: string;
};

export type ApiClientDetail = ApiClientListItem & {
  recent_orders: ApiClientOrderSummary[];
};

export type ClientOrderSummaryView = {
  id: string;
  number: string;
  title: string;
  status: OrderStatus;
  statusLabel: string;
  amountLabel: string;
  sport: string;
  createdAtLabel: string;
  href: string;
};

export type ClientCardView = Client & {
  recentOrders: ClientOrderSummaryView[];
};

const orderStatusLabels: Record<OrderStatus, string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  production: "В производстве",
  ready: "Готов",
  shipped: "Отгружен",
  completed: "Завершён",
  cancelled: "Отменён",
};

function formatAmount(amount: number | string | null) {
  if (amount === null || amount === "") return "—";
  const value = Number(amount);
  if (!Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
}

export function fromApiClientDetail(item: ApiClientDetail): ClientCardView {
  const base = fromApiClientListItem(item);
  return {
    ...base,
    recentOrders: (item.recent_orders ?? []).map((order) => ({
      id: String(order.id),
      number: order.number,
      title: order.title,
      status: order.status,
      statusLabel: orderStatusLabels[order.status] ?? order.status,
      amountLabel: formatAmount(order.amount),
      sport: order.sport ?? "Не указан",
      createdAtLabel: formatDate(order.created_at),
      href: `/sales/orders/${order.id}`,
    })),
  };
}
