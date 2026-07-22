import type { DashboardSnapshot } from "@/lib/dashboard/sales-dashboard-types";
import { InfoCard, SectionCard } from "@/components/ui/section-card";

export function TasksSummary({ tasks }: { tasks: DashboardSnapshot["tasks"] }) {
  return (
    <SectionCard title="Задачи">
      <div className="grid grid-cols-2 gap-portal-3">
        <InfoCard label="Сегодня" value={tasks.today} className="bg-portal-primary-soft" />
        <InfoCard label="Просрочено" value={tasks.overdue} className="bg-portal-danger-soft" />
        <InfoCard label="Ближайшие" value={tasks.upcoming} className="bg-portal-warning-soft" />
        <InfoCard label="Выполнено" value={tasks.completed} className="bg-portal-success-soft" />
      </div>
      <div className="mt-portal-5 space-y-portal-2">
        {tasks.byResponsible.map((item) => (
          <div key={item.name} className="flex justify-between gap-portal-3 text-portal-body">
            <span className="min-w-0 truncate text-portal-muted">{item.name}</span>
            <b className="shrink-0 text-portal-text">{item.count}</b>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
