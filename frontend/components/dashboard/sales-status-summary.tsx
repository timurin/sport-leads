import { currency } from "@/lib/dashboard/sales-dashboard";
import type { DashboardSnapshot } from "@/lib/dashboard/sales-dashboard-types";
import { SectionCard } from "./section-card";

const labels: Record<string, string> = { preparing: "Подготовка", sent: "Предложение", negotiation: "Переговоры", approval: "Согласование", contract: "Договор", paid: "Оплачено", lost: "Проиграно" };

export function SalesStatusSummary({ statuses }: { statuses: DashboardSnapshot["dealStatuses"] }) {
  const maximum = Math.max(1, ...statuses.map((item) => item.count));
  return (
    <SectionCard title="Статусы сделок">
      <div className="space-y-3">{statuses.map((item) => <div key={item.status}><div className="flex justify-between gap-3 text-sm"><span className="text-slate-700">{labels[item.status]}</span><span className="text-slate-500">{item.count} · {currency.format(item.amount)}</span></div><div className="mt-1.5 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-violet-500" style={{ width: `${(item.count / maximum) * 100}%` }} /></div></div>)}</div>
    </SectionCard>
  );
}
