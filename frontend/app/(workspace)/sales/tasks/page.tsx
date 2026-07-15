import { KanbanPage } from "@/components/kanban/kanban-page";
import { taskColumns } from "@/lib/demo-data/sales";

export default function TasksPage() {
  return (
    <KanbanPage
      title="Задачи"
      description="Работа сотрудников и контроль исполнения"
      createLabel="задачу"
      columns={taskColumns}
    />
  );
}