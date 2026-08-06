"use client";

import { updateOrderStatus } from "@/app/(workspace)/sales/orders/order-status-actions";
import { KanbanPage } from "@/components/kanban/kanban-page";
import {
  OrdersCreateDrawer,
  type OrderCreateClientOption,
} from "@/components/sales/orders-create-drawer";
import type { KanbanColumnData } from "@/components/kanban/kanban-types";
import type { OrderStatus } from "@/types/sales";

type OrdersWorkspaceProps = {
  columns: KanbanColumnData<OrderStatus>[];
  managers: string[];
  products: string[];
  statuses: string[];
  loadError?: string;
  clients: OrderCreateClientOption[];
  sessionResponsibleId: number | null;
  sessionResponsibleLabel: string | null;
};

/** Client host for orders kanban + real create drawer (`0.4.2`). */
export function OrdersWorkspace({
  columns,
  managers,
  products,
  statuses,
  loadError,
  clients,
  sessionResponsibleId,
  sessionResponsibleLabel,
}: OrdersWorkspaceProps) {
  return (
    <KanbanPage
      title="Заказы"
      description="Заказы клиентов и контроль этапов исполнения"
      actionLabel="Создать заказ"
      columns={columns}
      metrics={[
        { label: "Всего заказов", kind: "count" },
        { label: "В производстве", kind: "count", statuses: ["production"] },
        {
          label: "Сумма заказов",
          kind: "sum",
          valueKey: "amount",
          format: "currency",
        },
        { label: "Готовы к отгрузке", kind: "count", statuses: ["ready"] },
      ]}
      filters={[
        { id: "responsible", label: "Менеджер", options: managers },
        { id: "product", label: "Тип продукции", options: products },
        { id: "status", label: "Статус", options: statuses },
      ]}
      loadError={loadError}
      onMove={updateOrderStatus}
      renderCreateDrawer={({ open, onClose }) => (
        <OrdersCreateDrawer
          open={open}
          onClose={onClose}
          clients={clients}
          sessionResponsibleId={sessionResponsibleId}
          sessionResponsibleLabel={sessionResponsibleLabel}
        />
      )}
    />
  );
}
