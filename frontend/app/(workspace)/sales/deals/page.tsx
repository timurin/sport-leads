import { KanbanPage } from "@/components/kanban/kanban-page";
import { dealColumns, deals, salesCurrency, salesManagers } from "@/lib/demo-data/sales";

export default function DealsPage() {
  const openDeals = deals.filter((deal) => !["paid", "lost"].includes(deal.status));
  return <KanbanPage title="Сделки" description="Воронка продаж и коммерческие переговоры" actionLabel="Создать сделку" columns={dealColumns}
    metrics={[
      { label: "Открытые сделки", value: salesCurrency(openDeals.reduce((sum, deal) => sum + deal.amount, 0)) },
      { label: "Взвешенный прогноз", value: salesCurrency(openDeals.reduce((sum, deal) => sum + deal.amount * deal.probability / 100, 0)) },
      { label: "К закрытию в июле", value: String(openDeals.length), hint: "сделок" },
      { label: "Выиграно", value: String(deals.filter((deal) => deal.status === "paid").length), hint: "сделки" },
    ]}
    filters={[
      { id: "responsible", label: "Ответственный", options: salesManagers.map((manager) => manager.name) },
      { id: "sport", label: "Вид спорта", options: [...new Set(deals.map((deal) => deal.sport))] },
    ]}
  />;
}
