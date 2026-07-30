"use server";

import { revalidatePath } from "next/cache";

import {
  attachTechnicalCardToBatchApi,
  createProductionBatchApi,
  createProductionOrderApi,
  detachTechnicalCardFromBatchApi,
  type ProductionBatch,
  type ProductionOrderDetail,
} from "@/lib/production/production-orders";

export type ProductionOrderActionResult =
  | { ok: true; order: ProductionOrderDetail }
  | { ok: false; message: string };

export type ProductionBatchActionResult =
  | { ok: true; batch: ProductionBatch }
  | { ok: false; message: string };

function revalidateProductionOrderPaths(orderId?: number) {
  revalidatePath("/production/orders");
  if (orderId != null) {
    revalidatePath(`/production/orders/${orderId}`);
  }
}

export async function createProductionOrderAction(input: {
  sales_order_id: number;
  notes?: string | null;
}): Promise<ProductionOrderActionResult> {
  if (!Number.isSafeInteger(input.sales_order_id) || input.sales_order_id <= 0) {
    return { ok: false, message: "Укажите корректный ID заказа покупателя" };
  }
  try {
    const order = await createProductionOrderApi({
      sales_order_id: input.sales_order_id,
      notes: input.notes?.trim() || null,
    });
    revalidateProductionOrderPaths(order.id);
    return { ok: true, order };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Ошибка создания",
    };
  }
}

export async function createProductionBatchAction(
  orderId: number,
  input: { notes?: string | null; technical_card_ids?: number[] } = {},
): Promise<ProductionBatchActionResult> {
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return { ok: false, message: "Некорректный ID производственного заказа" };
  }
  try {
    const batch = await createProductionBatchApi(orderId, {
      notes: input.notes?.trim() || null,
      technical_card_ids: input.technical_card_ids ?? [],
    });
    revalidateProductionOrderPaths(orderId);
    return { ok: true, batch };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Ошибка создания партии",
    };
  }
}

export async function attachTechnicalCardToBatchAction(
  orderId: number,
  batchId: number,
  technicalCardId: number,
): Promise<ProductionBatchActionResult> {
  if (!Number.isSafeInteger(technicalCardId) || technicalCardId <= 0) {
    return { ok: false, message: "Укажите корректный ID техкарты" };
  }
  try {
    const batch = await attachTechnicalCardToBatchApi(batchId, technicalCardId);
    revalidateProductionOrderPaths(orderId);
    return { ok: true, batch };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Ошибка привязки",
    };
  }
}

export async function detachTechnicalCardFromBatchAction(
  orderId: number,
  batchId: number,
  technicalCardId: number,
): Promise<ProductionBatchActionResult> {
  try {
    const batch = await detachTechnicalCardFromBatchApi(batchId, technicalCardId);
    revalidateProductionOrderPaths(orderId);
    return { ok: true, batch };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Ошибка отвязки",
    };
  }
}
