import { KanbanPage } from "@/components/kanban/kanban-page";
import { orderColumns, orders, salesCurrency, salesManagers } from "@/lib/demo-data/sales";

export default function OrdersPage() {
  return <KanbanPage title="Заказы" description="Заказы клиентов и контроль этапов исполнения" actionLabel="Создать заказ" columns={orderColumns}
    metrics={[
      { label: "Всего заказов", value: String(orders.length) },
      { label: "В производстве", value: String(orders.filter((order) => order.status === "production").length) },
      { label: "Сумма заказов", value: salesCurrency(orders.reduce((sum, order) => sum + order.amount, 0)) },
      { label: "Готовы к отгрузке", value: String(orders.filter((order) => order.status === "ready").length) },
    ]}
    filters={[
      { id: "responsible", label: "Менеджер", options: salesManagers.map((manager) => manager.name) },
      { id: "product", label: "Тип продукции", options: [...new Set(orders.map((order) => order.productType))] },
      { id: "payment", label: "Оплата", options: ["Не оплачен", "Частично", "Оплачен", "Возврат"] },
    ]}
  />;
}
