import { KanbanPage } from "@/components/kanban/kanban-page";
import { orderColumns } from "@/lib/demo-data/sales";

export default function OrdersPage() {
  return (
    <KanbanPage
      title="Заказы"
      description="Заказы клиентов и контроль этапов исполнения"
      createLabel="заказ"
      columns={orderColumns}
    />
  );
}