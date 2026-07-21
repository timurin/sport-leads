import { KanbanPage } from "@/components/kanban/kanban-page";
import { salesManagers, salesTasks, taskColumns } from "@/lib/demo-data/sales";

export default function TasksPage() {
  return <KanbanPage title="Задачи" description="Работа менеджеров и контроль следующих действий" actionLabel="Создать задачу" columns={taskColumns}
    metrics={[
      { label: "Всего задач", kind: "count" },
      { label: "На сегодня", kind: "count", statuses: ["today"] },
      { label: "В работе", kind: "count", statuses: ["progress"] },
      { label: "Просрочено", kind: "count", statuses: ["overdue"] },
    ]}
    filters={[
      { id: "responsible", label: "Исполнитель", options: salesManagers.map((manager) => manager.name) },
      { id: "priority", label: "Приоритет", options: ["Высокий", "Средний", "Низкий"] },
      { id: "type", label: "Тип задачи", options: [...new Set(salesTasks.map((task) => task.type))] },
    ]}
  />;
}
