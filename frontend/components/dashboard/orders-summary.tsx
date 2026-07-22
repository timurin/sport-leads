import { currency } from "@/lib/dashboard/sales-dashboard";
import type { DashboardSnapshot } from "@/lib/dashboard/sales-dashboard-types";
import { InfoCard, SectionCard } from "@/components/ui/section-card";

export function OrdersSummary({ orders }: { orders: DashboardSnapshot["orders"] }) {
  const items = [
    ["Новые", orders.new],
    ["В работе", orders.active],
    ["Готовые", orders.ready],
    ["Завершённые", orders.completed],
    ["Просроченные", orders.overdue],
  ] as const;

  return (
    <SectionCard title="Заказы" description={`Общая сумма ${currency.format(orders.amount)}`}>
      <div className="grid grid-cols-2 gap-portal-3">
        {items.map(([label, value]) => (
          <InfoCard key={label} label={label} value={value} />
        ))}
      </div>
    </SectionCard>
  );
}
