import type { KanbanColumnData } from "@/components/kanban/kanban-types";
import type { OrderStatus } from "@/types/sales";

export type ApiSalesOrder = {
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

const statusPresentation: Record<OrderStatus, { title: string; accentClass: string; label: string }> = {
  new: { title: "Новый", accentClass: "bg-blue-500", label: "Новый" },
  confirmed: { title: "Подтверждён", accentClass: "bg-cyan-500", label: "Подтверждён" },
  production: { title: "В производстве", accentClass: "bg-violet-500", label: "В производстве" },
  ready: { title: "Готов", accentClass: "bg-amber-500", label: "Готов" },
  shipped: { title: "Отгружен", accentClass: "bg-orange-500", label: "Отгружен" },
  completed: { title: "Завершён", accentClass: "bg-emerald-500", label: "Завершён" },
  cancelled: { title: "Отменён", accentClass: "bg-slate-400", label: "Отменён" },
};

const statusOrder: OrderStatus[] = ["new", "confirmed", "production", "ready", "shipped", "completed", "cancelled"];

function formatAmount(amount: ApiSalesOrder["amount"]) {
  if (amount === null) return "—";
  return `${new Intl.NumberFormat("ru-RU").format(Number(amount))} ₽`;
}

export function fromApiSalesOrders(orders: ApiSalesOrder[]): KanbanColumnData<OrderStatus>[] {
  const cards = orders.map((order) => ({
    id: String(order.id),
    status: order.status,
    title: `Заказ ${order.number}`,
    href: `/sales/leads/${order.lead_id}`,
    subtitle: order.client_name ?? `Клиент #${order.client_id}`,
    amount: formatAmount(order.amount),
    badge: { label: statusPresentation[order.status].label, tone: order.status === "completed" ? "emerald" as const : order.status === "cancelled" ? "slate" as const : "blue" as const },
    responsible: order.responsible_name ?? (order.responsible_id === null ? "Не назначен" : `Сотрудник #${order.responsible_id}`),
    nextAction: order.desired_date ?? "Дата не указана",
    details: [{ label: order.product_category ?? order.title, value: `${order.quantity ?? 0} ед.` }],
    filters: {
      responsible: order.responsible_name ?? "Не назначен",
      product: order.product_category ?? order.title,
      status: statusPresentation[order.status].label,
    },
    metricValues: { amount: Number(order.amount ?? 0) },
  }));

  return statusOrder.map((status) => ({
    id: status,
    title: statusPresentation[status].title,
    accentClass: statusPresentation[status].accentClass,
    cards: cards.filter((card) => card.status === status),
  }));
}

export type OrderListResult =
  | { ok: true; columns: KanbanColumnData<OrderStatus>[]; orders: ApiSalesOrder[] }
  | { ok: false; message: string };

export async function getOrderList(): Promise<OrderListResult> {
  const apiUrl = process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/orders?limit=500`, { cache: "no-store" });
  if (!response.ok) {
    return { ok: false, message: `Не удалось загрузить заказы из backend (${response.status}).` };
  }
  const orders = await response.json() as ApiSalesOrder[];
  return { ok: true, orders, columns: fromApiSalesOrders(orders) };
}
