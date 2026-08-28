"use server";

import { revalidatePath } from "next/cache";

import {
  buildShopStageModulesFromCatalog,
  getShopStageModule,
  shopStageTransitionKind,
  SHOP_STAGE_MODULES,
  type ShopStageKanbanStatus,
} from "@/lib/production/shop-stage-modules";
import { getProductionStages } from "@/lib/production-stages";
import {
  completeTechnicalCardStage,
  fetchTechnicalCard,
  rollbackTechnicalCardStageKanban,
} from "@/lib/sales/order-tech-cards-api";

export type ShopKanbanMoveResult = {
  ok: boolean;
  message: string | null;
};

async function loadShopModules() {
  try {
    const stages = await getProductionStages({ active_only: true, limit: 200 });
    return buildShopStageModulesFromCatalog(stages);
  } catch {
    return SHOP_STAGE_MODULES;
  }
}

export async function moveShopStageKanbanCardAction(input: {
  cardId: number;
  fromStageCode: ShopStageKanbanStatus;
  toStageCode: ShopStageKanbanStatus;
}): Promise<ShopKanbanMoveResult> {
  const shopModules = await loadShopModules();
  const kind = shopStageTransitionKind(
    input.fromStageCode,
    input.toStageCode,
    shopModules,
  );
  if (kind == null) {
    return {
      ok: false,
      message: "Перемещение разрешено только на соседний цех по маршруту",
    };
  }

  const fromStage = getShopStageModule(input.fromStageCode, shopModules);
  if (!fromStage) {
    return { ok: false, message: "Неизвестный исходный цех" };
  }

  try {
    const card = await fetchTechnicalCard(input.cardId);
    if (card.current_stage_order == null) {
      return { ok: false, message: "У техкарты нет текущего этапа" };
    }
    if (card.current_stage_label !== fromStage.title) {
      return {
        ok: false,
        message: `Текущий этап техкарты «${card.current_stage_label ?? "—"}» не совпадает с колонкой «${fromStage.title}»`,
      };
    }

    if (kind === "forward") {
      await completeTechnicalCardStage(
        card.id,
        card.current_stage_order,
        {},
      );
    } else {
      const toStage = getShopStageModule(input.toStageCode, shopModules);
      if (!toStage) {
        return { ok: false, message: "Неизвестный целевой цех" };
      }

      const toStageRow = card.stage_results?.find(
        (row) => row.stage_label === toStage.title,
      );
      if (!toStageRow) {
        return {
          ok: false,
          message:
            "Не удалось определить stage_order для отката в предыдущий цех",
        };
      }

      await rollbackTechnicalCardStageKanban(
        card.id,
        toStageRow.stage_order,
      );
    }

    revalidatePath("/production/kanban");
    revalidatePath(`/production/tech-cards/${card.id}`);
    revalidatePath(`/production/stages/${input.fromStageCode}`);
    if (input.toStageCode !== "unassigned") {
      revalidatePath(`/production/stages/${input.toStageCode}`);
    }
    if (card.sales_order_id != null) {
      revalidatePath(`/sales/orders/${card.sales_order_id}`);
    }

    return {
      ok: true,
      message:
        kind === "forward"
          ? "Этап завершён, техкарта перешла дальше"
          : "Этап откатан на предыдущий цех",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось переместить техкарту",
    };
  }
}
