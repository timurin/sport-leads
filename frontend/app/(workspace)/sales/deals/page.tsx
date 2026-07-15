import { KanbanPage } from "@/components/kanban/kanban-page";
import { dealColumns } from "@/lib/demo-data/sales";

export default function DealsPage() {
  return (
    <KanbanPage
      title="Сделки"
      description="Воронка продаж и коммерческие переговоры"
      createLabel="сделку"
      columns={dealColumns}
    />
  );
}