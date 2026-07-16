import { currency } from "@/lib/dashboard/sales-dashboard";
import type { DashboardSnapshot } from "@/lib/dashboard/sales-dashboard-types";
import { SectionCard } from "./section-card";

export function OrdersSummary({ orders }: { orders: DashboardSnapshot["orders"] }) {
  const items = [["Новые", orders.new], ["В работе", orders.active], ["Готовые", orders.ready], ["Завершённые", orders.completed], ["Просроченные", orders.overdue]] as const;
  return <SectionCard title="Заказы" description={`Общая сумма ${currency.format(orders.amount)}`}><div className="grid grid-cols-2 gap-3">{items.map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><div className="text-2xl font-semibold text-slate-950">{value}</div><div className="mt-1 text-xs text-slate-500">{label}</div></div>)}</div></SectionCard>;
}
