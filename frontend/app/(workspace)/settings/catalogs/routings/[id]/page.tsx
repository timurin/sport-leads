import { notFound } from "next/navigation";

import { ShopRoutingDetailWorkspace } from "@/components/settings/shop-routing-detail-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import { getShopRoutingGraph } from "@/app/(workspace)/settings/catalogs/routings/routing-actions";
import {
  getShopRouting,
  getWorkCenters,
  parseShopRoutingRouteId,
} from "@/lib/shop-routings";
import { getTechOperations } from "@/lib/tech-operations";
import { getProductionStages } from "@/lib/production-stages";
import { getCapacityResources } from "@/lib/capacity-resources";
import { getNomenclature } from "@/lib/nomenclature";

type ShopRoutingDetailRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function ShopRoutingDetailPage({
  params,
}: ShopRoutingDetailRouteProps) {
  const { id: rawId } = await params;
  const routingId = parseShopRoutingRouteId(rawId);
  if (routingId == null) notFound();

  const [routing, techOperations, workCenters, productionStages, resources, routeGraph, nomenclature] = await Promise.all([
    getShopRouting(routingId),
    getTechOperations({ active_only: true, limit: 500 }),
    getWorkCenters({ active_only: true, limit: 500 }),
    getProductionStages({ active_only: true, limit: 500 }),
    getCapacityResources(),
    getShopRoutingGraph(routingId),
    getNomenclature(),
  ]);
  if (!routing) notFound();
  const materialOptions = nomenclature
    .filter((row) => row.nomenclature_type === "MATERIAL" && row.is_active)
    .map((row) => ({ id: row.id, name: row.name, unit: row.unit, is_active: row.is_active }));

  return (
    <PageLayout>
      <ShopRoutingDetailWorkspace
        routing={routing}
        techOperations={techOperations}
        workCenters={workCenters}
        productionStages={productionStages}
        resources={resources}
        materialOptions={materialOptions}
        graph={routeGraph.graph}
        nodeReadiness={routeGraph.nodeReadiness}
        diagnostics={routeGraph.diagnostics}
      />
    </PageLayout>
  );
}
