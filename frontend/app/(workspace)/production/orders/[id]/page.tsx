import { notFound } from "next/navigation";

import {
  listProductionOrderWorkTasks,
  listWorkTaskFilterUsers,
} from "@/app/(workspace)/sales/tasks/work-task-actions";
import { ProductionOrderDetailWorkspace } from "@/components/production/production-order-detail-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import {
  fetchProductionOrder,
  fetchProductionOrderBatchFactRollups,
  fetchProductionOrderFactRollup,
  type ProductionFactRollup,
} from "@/lib/production/production-orders";
import { getProductionStages } from "@/lib/production-stages";
import {
  fetchTechnicalCards,
  type ApiTechnicalCardListItem,
} from "@/lib/sales/order-tech-cards-api";

function parseId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return id;
}

export default async function ProductionOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const orderId = parseId(rawId);
  if (orderId == null) notFound();

  let order;
  let technicalCards: ApiTechnicalCardListItem[] = [];
  let orderRollup: ProductionFactRollup;
  let batchRollups: Record<number, ProductionFactRollup> = {};
  let workTasksLoaded;
  let stagesCatalog;
  let usersLoaded;
  try {
    order = await fetchProductionOrder(orderId);
    const [cards, rollup, rollupsByBatch, tasksResult, stages, users] =
      await Promise.all([
        fetchTechnicalCards({
          sales_order_id: order.sales_order_id,
          limit: 500,
        }),
        fetchProductionOrderFactRollup(orderId),
        fetchProductionOrderBatchFactRollups(orderId),
        listProductionOrderWorkTasks(orderId),
        getProductionStages({ active_only: true, limit: 200 }).catch(() => []),
        listWorkTaskFilterUsers(),
      ]);
    technicalCards = cards;
    orderRollup = rollup;
    batchRollups = rollupsByBatch;
    workTasksLoaded = tasksResult;
    stagesCatalog = stages;
    usersLoaded = users;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("404") || message.toLowerCase().includes("не найден")) {
      notFound();
    }
    throw error;
  }

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <ProductionOrderDetailWorkspace
        order={order}
        technicalCards={technicalCards}
        orderRollup={orderRollup}
        batchRollups={batchRollups}
        workTasks={workTasksLoaded.ok ? workTasksLoaded.data : []}
        workTasksError={workTasksLoaded.ok ? null : workTasksLoaded.message}
        workTaskStages={stagesCatalog.map((stage) => ({
          id: stage.id,
          label: stage.name,
        }))}
        workTaskUsers={usersLoaded.ok ? usersLoaded.data : []}
      />
    </PageLayout>
  );
}
