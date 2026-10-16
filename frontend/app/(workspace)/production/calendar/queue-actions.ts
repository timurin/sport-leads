"use server";

import { revalidatePath } from "next/cache";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import {
  isProductionQueueCard,
  priorityPatch,
  queueCalendarRefreshPaths,
  readQueueSchedule,
  shouldRefreshCalendar,
  type QueueCardRow,
  type QueueSchedule,
} from "@/lib/production/production-queue";
import {
  fetchTechnicalCards,
  scheduleProductionQueue,
  updateTechnicalCardPlanning,
} from "@/lib/sales/order-tech-cards-api";

export type QueueCardsResult = { ok: true; cards: QueueCardRow[] } | { ok: false; message: string; cards: [] };

export async function loadProductionQueueAction(): Promise<QueueCardsResult> {
  try {
    const auth = await sessionAuthHeaders();
    const [drafts, active] = await Promise.all([
      fetchTechnicalCards({ status: "draft", limit: 500 }, auth),
      fetchTechnicalCards({ status: "in_progress", limit: 500 }, auth),
    ]);
    const cards = [...drafts, ...active].filter(isProductionQueueCard).map((card) => ({
      id: card.id,
      number: card.number,
      display_number: card.display_number,
      order_number: card.order_number,
      priority: card.priority ?? null,
      shipping_date: card.shipping_date ?? null,
      planning_start_date: card.planning_start_date ?? null,
      plan_locked: card.plan_locked === true,
      status: card.status,
      sales_order_id: card.sales_order_id,
      order_group_id: card.order_group_id,
      created_at: card.created_at,
    }));
    return { ok: true, cards };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Не удалось открыть очередь", cards: [] };
  }
}

export async function saveQueuePrioritiesAction(
  updates: { id: number; priority: string }[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!updates.length) return { ok: false, message: "Нет изменённых приоритетов" };
  try {
    const auth = await sessionAuthHeaders();
    for (const update of updates) {
      const parsed = priorityPatch(update.priority);
      if (!parsed.ok) return parsed;
      await updateTechnicalCardPlanning(update.id, { priority: parsed.priority }, auth);
      revalidatePath(`/production/tech-cards/${update.id}`);
    }
    revalidatePath("/production/tech-cards");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Не удалось сохранить приоритет" };
  }
}

export type QueueScheduleActionResult = {
  ok: boolean;
  message: string | null;
  schedule: QueueSchedule | null;
};

export async function scheduleProductionQueueAction(): Promise<QueueScheduleActionResult> {
  try {
    const auth = await sessionAuthHeaders();
    const schedule = readQueueSchedule(await scheduleProductionQueue(auth));
    if (shouldRefreshCalendar(schedule)) {
      for (const path of queueCalendarRefreshPaths()) revalidatePath(path);
      revalidatePath("/production/tech-cards");
    }
    return { ok: true, message: null, schedule };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Очередь не пересчитана",
      schedule: null,
    };
  }
}
