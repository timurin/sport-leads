import { notFound } from "next/navigation";

import { ShopStageQueueWorkspace } from "@/components/production/shop-stage-queue-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import {
  buildShopStageModulesFromCatalog,
  getShopStageModule,
} from "@/lib/production/shop-stage-modules";
import { getProductionStages } from "@/lib/production-stages";
import { fetchTechnicalCards } from "@/lib/sales/order-tech-cards-api";

export default async function ProductionShopStagePage({
  params,
}: {
  params: Promise<{ stageCode: string }>;
}) {
  const { stageCode } = await params;

  let shopModules = undefined;
  try {
    const stages = await getProductionStages({ active_only: true, limit: 200 });
    shopModules = buildShopStageModulesFromCatalog(stages);
  } catch {
    shopModules = undefined;
  }

  const stage = getShopStageModule(stageCode, shopModules);
  if (!stage) {
    notFound();
  }
  const cards = await fetchTechnicalCards({ stage: stage.title, limit: 500 });

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <ShopStageQueueWorkspace
        stageCode={stage.code}
        stageTitle={stage.title}
        cards={cards}
      />
    </PageLayout>
  );
}
