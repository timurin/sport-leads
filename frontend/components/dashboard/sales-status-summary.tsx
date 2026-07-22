import { currency } from "@/lib/dashboard/sales-dashboard";
import type { DashboardSnapshot } from "@/lib/dashboard/sales-dashboard-types";
import { SectionCard } from "@/components/ui/section-card";

const labels: Record<string, string> = {
  preparing: "Подготовка",
  sent: "Предложение",
  negotiation: "Переговоры",
  approval: "Согласование",
  contract: "Договор",
  paid: "Оплачено",
  lost: "Проиграно",
};

export function SalesStatusSummary({
  statuses,
}: {
  statuses: DashboardSnapshot["dealStatuses"];
}) {
  const maximum = Math.max(1, ...statuses.map((item) => item.count));
  return (
    <SectionCard title="Статусы сделок">
      <div className="space-y-portal-3">
        {statuses.map((item) => (
          <div key={item.status} className="min-w-0">
            <div className="flex justify-between gap-portal-3 text-portal-body">
              <span className="min-w-0 truncate text-portal-text">{labels[item.status]}</span>
              <span className="shrink-0 text-portal-muted">
                {item.count} · {currency.format(item.amount)}
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-portal-full bg-portal-surface-secondary">
              <div
                className="h-2 rounded-portal-full bg-violet-500"
                style={{ width: `${(item.count / maximum) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
