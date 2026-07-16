import { KanbanPage } from "@/components/kanban/kanban-page";
import { leadColumns, leads, salesManagers } from "@/lib/demo-data/sales";

export default function LeadsPage() {
  return <KanbanPage title="Лиды" description="Первичные обращения и потенциальные клиенты спортивного бизнеса" actionLabel="Добавить лид" columns={leadColumns}
    metrics={[
      { label: "Всего лидов", kind: "count" },
      { label: "Новые", kind: "count", statuses: ["new"] },
      { label: "Потенциальные продажи", kind: "sum", valueKey: "amount", format: "currency" },
      { label: "Конверсия в успешные", kind: "ratio", numerator: { statuses: ["won"] }, denominator: {} },
    ]}
    filters={[
      { id: "responsible", label: "Ответственный", options: salesManagers.map((manager) => manager.name) },
      { id: "priority", label: "Приоритет", options: ["Высокий", "Средний", "Низкий"] },
      { id: "source", label: "Источник", options: [...new Set(leads.map((lead) => lead.source))] },
    ]}
  />;
}
