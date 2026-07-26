"use server";

import { revalidatePath } from "next/cache";

import {
  fetchOrderTechnicalCards,
  fetchOrderTechnicalCardsPreview,
  generateOrderTechnicalCards,
} from "@/lib/sales/order-tech-cards-api";
import {
  buildOrderTechCardRows,
  buildOrderTechCardsSummary,
  type OrderTechCardRow,
  type OrderTechCardsSummary,
} from "@/lib/sales/order-tech-cards";

export type OrderTechCardsState = {
  ok: boolean;
  message: string | null;
  rows: OrderTechCardRow[];
  summary: OrderTechCardsSummary | null;
  createCount: number;
  reviveCount: number;
};

async function loadState(orderId: string): Promise<OrderTechCardsState> {
  const preview = await fetchOrderTechnicalCardsPreview(orderId);
  const cards = await fetchOrderTechnicalCards(orderId);
  const rows = buildOrderTechCardRows(preview, cards);
  const summary = buildOrderTechCardsSummary(orderId, rows, cards);
  return {
    ok: true,
    message: null,
    rows,
    summary,
    createCount: preview.create_count,
    reviveCount: preview.revive_count,
  };
}

export async function loadOrderTechCardsState(orderId: string): Promise<OrderTechCardsState> {
  try {
    return await loadState(orderId);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Не удалось загрузить техкарты",
      rows: [],
      summary: null,
      createCount: 0,
      reviveCount: 0,
    };
  }
}

export async function generateOrderTechCardsAction(
  orderId: string,
): Promise<OrderTechCardsState & { generated: number }> {
  try {
    const result = await generateOrderTechnicalCards(orderId);
    revalidatePath(`/sales/orders/${orderId}`);
    revalidatePath("/production/tech-cards");
    const state = await loadState(orderId);
    const generated = result.created.length + result.revived.length;
    return {
      ...state,
      generated,
      message:
        generated === 0
          ? "Новых техкарт не создано (все eligible позиции уже имеют активную ТК)."
          : `Сформировано: создано ${result.created.length}, восстановлено ${result.revived.length}.`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Ошибка формирования техкарт",
      rows: [],
      summary: null,
      createCount: 0,
      reviveCount: 0,
      generated: 0,
    };
  }
}
