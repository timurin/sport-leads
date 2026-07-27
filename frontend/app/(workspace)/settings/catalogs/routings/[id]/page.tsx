import { notFound } from "next/navigation";

import { ShopRoutingDetailWorkspace } from "@/components/settings/shop-routing-detail-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import {
  getShopRouting,
  getWorkCenters,
  parseShopRoutingRouteId,
} from "@/lib/shop-routings";
import { getTechOperations } from "@/lib/tech-operations";
import { getProductionStages } from "@/lib/production-stages";

type ShopRoutingDetailRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function ShopRoutingDetailPage({
  params,
}: ShopRoutingDetailRouteProps) {
  const { id: rawId } = await params;
  const routingId = parseShopRoutingRouteId(rawId);
  if (routingId == null) notFound();

  const [routing, techOperations, workCenters, productionStages] = await Promise.all([
    getShopRouting(routingId),
    getTechOperations({ active_only: true, limit: 500 }),
    getWorkCenters({ active_only: true, limit: 500 }),
    getProductionStages({ active_only: true, limit: 500 }),
  ]);
  if (!routing) notFound();

  return (
    <PageLayout>
      <ShopRoutingDetailWorkspace
        routing={routing}
        techOperations={techOperations}
        workCenters={workCenters}
        productionStages={productionStages}
      />
    </PageLayout>
  );
}
