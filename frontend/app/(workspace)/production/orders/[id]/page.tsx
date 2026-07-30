import { notFound } from "next/navigation";

import { ProductionOrderDetailWorkspace } from "@/components/production/production-order-detail-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import {
  fetchProductionBatchFactRollup,
  fetchProductionOrder,
  fetchProductionOrderFactRollup,
  type ProductionFactRollup,
} from "@/lib/production/production-orders";
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
  try {
    order = await fetchProductionOrder(orderId);
    const [cards, rollup, ...batchResults] = await Promise.all([
      fetchTechnicalCards({
        sales_order_id: order.sales_order_id,
        limit: 500,
      }),
      fetchProductionOrderFactRollup(orderId),
      ...order.batches.map((batch) => fetchProductionBatchFactRollup(batch.id)),
    ]);
    technicalCards = cards;
    orderRollup = rollup;
    batchRollups = Object.fromEntries(
      order.batches.map((batch, index) => [batch.id, batchResults[index]]),
    );
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
      />
    </PageLayout>
  );
}
