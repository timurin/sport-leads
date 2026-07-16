import { KanbanPage } from "@/components/kanban/kanban-page";
import { orderColumns, orders, salesManagers } from "@/lib/demo-data/sales";

export default function OrdersPage() {
  return <KanbanPage title="Заказы" description="Заказы клиентов и контроль этапов исполнения" actionLabel="Создать заказ" columns={orderColumns}
    metrics={[
      { label: "Всего заказов", kind: "count" },
      { label: "В производстве", kind: "count", statuses: ["production"] },
      { label: "Сумма заказов", kind: "sum", valueKey: "amount", format: "currency" },
      { label: "Готовы к отгрузке", kind: "count", statuses: ["ready"] },
    ]}
    filters={[
      { id: "responsible", label: "Менеджер", options: salesManagers.map((manager) => manager.name) },
      { id: "product", label: "Тип продукции", options: [...new Set(orders.map((order) => order.productType))] },
      { id: "payment", label: "Оплата", options: ["Не оплачен", "Частично", "Оплачен", "Возврат"] },
    ]}
  />;
}
