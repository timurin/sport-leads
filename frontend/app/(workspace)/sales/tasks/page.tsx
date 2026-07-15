import { KanbanPage } from "@/components/kanban/kanban-page";
import { salesManagers, salesTasks, taskColumns } from "@/lib/demo-data/sales";

export default function TasksPage() {
  return <KanbanPage title="Задачи" description="Работа менеджеров и контроль следующих действий" actionLabel="Добавить задачу" columns={taskColumns}
    metrics={[
      { label: "Всего задач", value: String(salesTasks.length) },
      { label: "На сегодня", value: String(salesTasks.filter((task) => task.status === "today").length) },
      { label: "В работе", value: String(salesTasks.filter((task) => task.status === "progress").length) },
      { label: "Просрочено", value: String(salesTasks.filter((task) => task.status === "overdue").length) },
    ]}
    filters={[
      { id: "responsible", label: "Исполнитель", options: salesManagers.map((manager) => manager.name) },
      { id: "priority", label: "Приоритет", options: ["Высокий", "Средний", "Низкий"] },
      { id: "type", label: "Тип задачи", options: [...new Set(salesTasks.map((task) => task.type))] },
    ]}
  />;
}
