import { Suspense } from "react";

import { ShopStageKanbanWorkspace } from "@/components/production/shop-stage-kanban-workspace";
import { TechCardsWorkspace } from "@/components/production/tech-cards-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import { getMe } from "@/lib/auth/session";
import {
  hasPermission,
  PERM_SHOP_KANBAN_TRANSITION,
} from "@/lib/auth/session-mapping";
import { getNomenclature, getNomenclatureCategories } from "@/lib/nomenclature";
import {
  buildShopStageModulesFromCatalog,
  SHOP_STAGE_MODULES,
} from "@/lib/production/shop-stage-modules";
import { parseTechCardListView } from "@/lib/production/tech-cards";
import { getProductionStages } from "@/lib/production-stages";
import { fetchTechnicalCards } from "@/lib/sales/order-tech-cards-api";

async function loadCards(orderId: string | undefined) {
  try {
    const cards = await fetchTechnicalCards(
      orderId ? { sales_order_id: orderId, limit: 500 } : { limit: 500 },
    );
    return { ok: true as const, cards, message: null };
  } catch (error) {
    return {
      ok: false as const,
      cards: [],
      message: error instanceof Error ? error.message : "Не удалось загрузить техкарты",
    };
  }
}

async function loadProductNomenclatures() {
  try {
    const rows = await getNomenclature();
    return rows.filter((row) => row.nomenclature_type === "PRODUCT" && row.is_active);
  } catch {
    return [];
  }
}

async function loadCategories() {
  try {
    return await getNomenclatureCategories();
  } catch {
    return [];
  }
}

export default async function ProductionTechCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; view?: string }>;
}) {
  const params = await searchParams;
  const orderId = params.orderId?.trim() || undefined;
  const view = parseTechCardListView(params.view);
  const [state, productNomenclatures, categories] = await Promise.all([
    loadCards(orderId),
    loadProductNomenclatures(),
    loadCategories(),
  ]);

  let kanban = null;
  if (view === "kanban") {
    const me = await getMe();
    const canTransition = hasPermission(me, PERM_SHOP_KANBAN_TRANSITION);
    let shopModules = SHOP_STAGE_MODULES;
    try {
      const stages = await getProductionStages({ active_only: true, limit: 200 });
      shopModules = buildShopStageModulesFromCatalog(stages);
    } catch {
      shopModules = SHOP_STAGE_MODULES;
    }
    kanban = (
      <ShopStageKanbanWorkspace
        cards={state.cards}
        shopModules={shopModules}
        canTransition={canTransition}
        hideToolbar
      />
    );
  }

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      {!state.ok ? (
        <div
          className="p-portal-6 text-portal-body text-portal-danger"
          role="alert"
        >
          {state.message ?? "Не удалось загрузить техкарты"}
        </div>
      ) : null}
      <Suspense
        fallback={
          <div className="p-portal-6 text-portal-body text-portal-muted">
            Загрузка техкарт…
          </div>
        }
      >
        <TechCardsWorkspace
          cards={state.cards}
          orderId={orderId}
          productNomenclatures={productNomenclatures}
          categories={categories}
          view={view}
          kanban={kanban}
        />
      </Suspense>
    </PageLayout>
  );
}
