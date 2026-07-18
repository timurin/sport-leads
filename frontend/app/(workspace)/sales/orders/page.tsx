import { KanbanPage } from "@/components/kanban/kanban-page";
import { updateOrderStatus } from "@/app/(workspace)/sales/orders/order-status-actions";
import { getOrderList } from "@/lib/sales/order-list-api";

export default async function OrdersPage() {
  const orderList = await getOrderList();
  const orders = orderList.ok ? orderList.orders : [];
  const columns = orderList.ok ? orderList.columns : [];
  const managers = [...new Set(orders.map((order) => order.responsible_name ?? (order.responsible_id === null ? "Не назначен" : `Сотрудник #${order.responsible_id}`)))];
  const products = [...new Set(orders.map((order) => order.product_category ?? order.title))];
  const statuses = [...new Set(orders.map((order) => columns.find((column) => column.id === order.status)?.title ?? order.status))];

  return <KanbanPage
    title="Заказы"
    description="Заказы клиентов и контроль этапов исполнения"
    actionLabel="Создать заказ"
    columns={columns}
    metrics={[
      { label: "Всего заказов", kind: "count" },
      { label: "В производстве", kind: "count", statuses: ["production"] },
      { label: "Сумма заказов", kind: "sum", valueKey: "amount", format: "currency" },
      { label: "Готовы к отгрузке", kind: "count", statuses: ["ready"] },
    ]}
    filters={[
      { id: "responsible", label: "Менеджер", options: managers },
      { id: "product", label: "Тип продукции", options: products },
      { id: "status", label: "Статус", options: statuses },
    ]}
    loadError={orderList.ok ? undefined : orderList.message}
    onMove={updateOrderStatus}
  />;
}
