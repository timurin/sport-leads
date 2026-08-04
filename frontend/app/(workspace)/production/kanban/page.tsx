import { ShopStageKanbanWorkspace } from "@/components/production/shop-stage-kanban-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import { getMe } from "@/lib/auth/session";
import {
  hasPermission,
  PERM_SHOP_KANBAN_TRANSITION,
} from "@/lib/auth/session-mapping";
import {
  buildShopStageModulesFromCatalog,
  SHOP_STAGE_MODULES,
} from "@/lib/production/shop-stage-modules";
import { getProductionStages } from "@/lib/production-stages";
import {
  fetchTechnicalCards,
  type ApiTechnicalCardListItem,
} from "@/lib/sales/order-tech-cards-api";

export default async function ProductionShopKanbanPage() {
  let cards: ApiTechnicalCardListItem[] = [];
  let loadError: string | null = null;
  let shopModules = SHOP_STAGE_MODULES;
  const me = await getMe();
  const canTransition = hasPermission(me, PERM_SHOP_KANBAN_TRANSITION);

  try {
    const [cardRows, stages] = await Promise.all([
      fetchTechnicalCards({ limit: 500 }),
      getProductionStages({ active_only: true, limit: 200 }),
    ]);
    cards = cardRows;
    shopModules = buildShopStageModulesFromCatalog(stages);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Не удалось загрузить техкарты";
  }

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      {loadError ? (
        <div className="p-portal-6 text-portal-body text-portal-danger" role="alert">
          {loadError}
        </div>
      ) : (
        <ShopStageKanbanWorkspace
          cards={cards}
          shopModules={shopModules}
          canTransition={canTransition}
        />
      )}
    </PageLayout>
  );
}
