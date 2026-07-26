"use server";

import { revalidatePath } from "next/cache";

import {
  completeTechnicalCardStage,
  generateOrderTechnicalCards,
  rollbackTechnicalCardStage,
  startTechnicalCard,
  startTechnicalCardStage,
  type ApiTechnicalCard,
  type TechnicalCardStageCompletePayload,
  type TechnicalCardStageStartPayload,
} from "@/lib/sales/order-tech-cards-api";

export type TechCardActionResult = {
  ok: boolean;
  message: string | null;
  card: ApiTechnicalCard | null;
};

function success(card: ApiTechnicalCard, message: string | null = null): TechCardActionResult {
  return { ok: true, message, card };
}

function failure(message: string): TechCardActionResult {
  return { ok: false, message, card: null };
}

function revalidateTechCardPaths(cardId: number | string, orderId?: number | string) {
  revalidatePath("/production/tech-cards");
  revalidatePath(`/production/tech-cards/${cardId}`);
  if (orderId != null) {
    revalidatePath(`/sales/orders/${orderId}`);
  }
}

export async function generateTechCardsFromOrderAction(
  orderId: string,
): Promise<TechCardActionResult & { generated: number }> {
  try {
    const result = await generateOrderTechnicalCards(orderId);
    const generated = result.created.length + result.revived.length;
    revalidatePath("/production/tech-cards");
    revalidatePath(`/sales/orders/${orderId}`);
    return {
      ok: true,
      message:
        generated === 0
          ? "Новых техкарт не создано (все eligible позиции уже имеют активную ТК)."
          : `Сформировано: создано ${result.created.length}, восстановлено ${result.revived.length}.`,
      card: null,
      generated,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Ошибка формирования техкарт",
      card: null,
      generated: 0,
    };
  }
}

export async function startTechnicalCardAction(
  cardId: number,
  orderId?: number,
): Promise<TechCardActionResult> {
  try {
    const card = await startTechnicalCard(cardId);
    revalidateTechCardPaths(cardId, orderId ?? card.sales_order_id);
    return success(card, "Техкарта запущена");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Не удалось запустить техкарту");
  }
}

export async function startTechnicalCardStageAction(
  cardId: number,
  stageOrder: number,
  payload: TechnicalCardStageStartPayload = {},
  orderId?: number,
): Promise<TechCardActionResult> {
  try {
    const card = await startTechnicalCardStage(cardId, stageOrder, payload);
    revalidateTechCardPaths(cardId, orderId ?? card.sales_order_id);
    return success(card, "Этап запущен");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Не удалось запустить этап");
  }
}

export async function completeTechnicalCardStageAction(
  cardId: number,
  stageOrder: number,
  payload: TechnicalCardStageCompletePayload = {},
  orderId?: number,
): Promise<TechCardActionResult> {
  try {
    const card = await completeTechnicalCardStage(cardId, stageOrder, payload);
    revalidateTechCardPaths(cardId, orderId ?? card.sales_order_id);
    return success(card, "Этап завершён");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Не удалось завершить этап");
  }
}

export async function rollbackTechnicalCardStageAction(
  cardId: number,
  stageOrder: number,
  orderId?: number,
): Promise<TechCardActionResult> {
  try {
    const card = await rollbackTechnicalCardStage(cardId, stageOrder);
    revalidateTechCardPaths(cardId, orderId ?? card.sales_order_id);
    return success(card, "Этап возвращён в работу");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Не удалось откатить этап");
  }
}
