import { KanbanPage } from "@/components/kanban/kanban-page";
import { leadColumns } from "@/lib/demo-data/sales";

export default function LeadsPage() {
  return (
    <KanbanPage
      title="Лиды"
      description="Первичные обращения и потенциальные клиенты"
      createLabel="лид"
      columns={leadColumns}
    />
  );
}