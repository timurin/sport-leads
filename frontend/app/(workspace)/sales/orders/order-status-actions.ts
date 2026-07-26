"use server";

import { updateApiOrderStatus } from "@/lib/sales/order-list-api";
import type { KanbanMove } from "@/components/kanban/kanban-types";
import type { OrderStatus } from "@/types/sales";

const orderStatuses: OrderStatus[] = [
  "new",
  "confirmed",
  "production",
  "ready",
  "shipped",
  "completed",
  "cancelled",
];

export type OrderStatusActionResult = {
  ok: boolean;
  message: string;
};

export async function setOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<OrderStatusActionResult> {
  if (!/^\d+$/.test(orderId) || !orderStatuses.includes(status)) {
    return { ok: false, message: "Не удалось изменить статус заказа." };
  }

  try {
    const result = await updateApiOrderStatus(orderId, status);
    return result.ok
      ? { ok: true, message: "Статус заказа обновлён." }
      : { ok: false, message: result.message };
  } catch {
    return { ok: false, message: "Не удалось связаться с backend." };
  }
}

export async function updateOrderStatus(
  move: KanbanMove<OrderStatus>,
): Promise<OrderStatusActionResult> {
  return setOrderStatus(move.cardId, move.targetColumnId);
}
