import { KanbanPage } from "@/components/kanban/kanban-page";
import { dealColumns, deals, salesManagers } from "@/lib/demo-data/sales";

export default function DealsPage() {
  return <KanbanPage title="Сделки" description="Воронка продаж и коммерческие переговоры" actionLabel="Создать сделку" columns={dealColumns}
    metrics={[
      { label: "Открытые сделки", kind: "sum", valueKey: "amount", format: "currency", excludeStatuses: ["paid", "lost"] },
      { label: "Взвешенный прогноз", kind: "sum", valueKey: "weightedAmount", format: "currency", excludeStatuses: ["paid", "lost"] },
      { label: "К закрытию в июле", kind: "count", excludeStatuses: ["paid", "lost"], hint: "сделок" },
      { label: "Выиграно", kind: "count", statuses: ["paid"], hint: "сделки" },
    ]}
    filters={[
      { id: "responsible", label: "Ответственный", options: salesManagers.map((manager) => manager.name) },
      { id: "sport", label: "Вид спорта", options: [...new Set(deals.map((deal) => deal.sport))] },
    ]}
  />;
}
