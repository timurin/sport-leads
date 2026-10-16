"use server";

import type { ShopStageKanbanStatus } from "@/lib/production/shop-stage-modules";

export type ShopKanbanMoveResult = { ok: boolean; message: string | null };

export async function moveShopStageKanbanCardAction(_input: {
  cardId: number;
  fromStageCode: ShopStageKanbanStatus;
  toStageCode: ShopStageKanbanStatus;
}): Promise<ShopKanbanMoveResult> {
  return {
    ok: false,
    message: "Цех определяется выполненными операциями. Откройте техкарту, чтобы начать или завершить работу.",
  };
}
