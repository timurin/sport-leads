import { Suspense } from "react";

import { ProductionOrdersWorkspace } from "@/components/production/production-orders-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import {
  fetchProductionOrders,
  type ProductionOrderListItem,
} from "@/lib/production/production-orders";
import { fetchTechnicalCards } from "@/lib/sales/order-tech-cards-api";

type SalesOrderOption = {
  salesOrderId: number;
  salesOrderNumber: string;
  technicalCardCount: number;
};

type StandaloneGroupOption = {
  orderGroupId: number;
  orderNumber: string;
  technicalCardCount: number;
};

type TechCardQuickItem = {
  id: number;
  number: string;
  status: string;
};

export default async function ProductionOrdersPage() {
  let orders: ProductionOrderListItem[] = [];
  let salesOrderOptions: SalesOrderOption[] = [];
  let standaloneGroupOptions: StandaloneGroupOption[] = [];
  let techCardsQuick: TechCardQuickItem[] = [];
  let loadError: string | null = null;
  try {
    orders = await fetchProductionOrders({ limit: 500 });
    const cards = await fetchTechnicalCards({ limit: 500 });
    techCardsQuick = cards.slice(0, 4).map((card) => ({
      id: card.id,
      number: card.number,
      status: String(card.status),
    }));
    const byOrder = new Map<number, SalesOrderOption>();
    const byGroup = new Map<number, StandaloneGroupOption>();
    for (const card of cards) {
      if (card.sales_order_id != null) {
        const existing = byOrder.get(card.sales_order_id);
        if (existing) {
          existing.technicalCardCount += 1;
          continue;
        }
        byOrder.set(card.sales_order_id, {
          salesOrderId: card.sales_order_id,
          salesOrderNumber: card.order_number?.trim() || `#${card.sales_order_id}`,
          technicalCardCount: 1,
        });
        continue;
      }
      if (card.order_group_id == null) continue;
      const existingGroup = byGroup.get(card.order_group_id);
      if (existingGroup) {
        existingGroup.technicalCardCount += 1;
        continue;
      }
      byGroup.set(card.order_group_id, {
        orderGroupId: card.order_group_id,
        orderNumber: card.order_number?.trim() || `#${card.order_group_id}`,
        technicalCardCount: 1,
      });
    }
    salesOrderOptions = Array.from(byOrder.values()).sort((left, right) =>
      left.salesOrderNumber.localeCompare(right.salesOrderNumber, "ru"),
    );
    standaloneGroupOptions = Array.from(byGroup.values()).sort((left, right) =>
      left.orderNumber.localeCompare(right.orderNumber, "ru"),
    );
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Не удалось загрузить производственные заказы";
  }

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      {loadError ? (
        <div className="p-portal-6 text-portal-body text-portal-danger" role="alert">
          {loadError}
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="p-portal-6 text-portal-body text-portal-muted">
              Загрузка производственных заказов…
            </div>
          }
        >
          <ProductionOrdersWorkspace
            orders={orders}
            salesOrderOptions={salesOrderOptions}
            standaloneGroupOptions={standaloneGroupOptions}
            techCardsQuick={techCardsQuick}
          />
        </Suspense>
      )}
    </PageLayout>
  );
}
