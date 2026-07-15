import { KanbanPage } from "@/components/kanban/kanban-page";
import { leadColumns, leads, salesCurrency, salesManagers } from "@/lib/demo-data/sales";

export default function LeadsPage() {
  const won = leads.filter((lead) => lead.status === "won").length;
  return <KanbanPage title="Лиды" description="Первичные обращения и потенциальные клиенты спортивного бизнеса" actionLabel="Добавить лид" columns={leadColumns}
    metrics={[
      { label: "Всего лидов", value: String(leads.length) },
      { label: "Новые", value: String(leads.filter((lead) => lead.status === "new").length) },
      { label: "Потенциальные продажи", value: salesCurrency(leads.reduce((sum, lead) => sum + lead.estimatedAmount, 0)) },
      { label: "Конверсия в успешные", value: `${Math.round((won / leads.length) * 100)}%` },
    ]}
    filters={[
      { id: "responsible", label: "Ответственный", options: salesManagers.map((manager) => manager.name) },
      { id: "priority", label: "Приоритет", options: ["Высокий", "Средний", "Низкий"] },
      { id: "source", label: "Источник", options: [...new Set(leads.map((lead) => lead.source))] },
    ]}
  />;
}
