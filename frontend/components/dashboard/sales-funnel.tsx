import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import { currency } from "@/lib/dashboard/sales-dashboard";
import type { FunnelStage } from "@/lib/dashboard/sales-dashboard-types";

export function SalesFunnel({ stages }: { stages: FunnelStage[] }) {
  const maximum = Math.max(1, ...stages.map((stage) => stage.count));
  return (
    <SectionCard title="Воронка продаж" description="Переходы между ключевыми этапами">
      {stages.length ? (
        <div className="space-y-portal-4">
          {stages.map((stage) => (
            <div key={stage.label} className="min-w-0">
              <div className="mb-1.5 flex items-center justify-between gap-portal-3 text-portal-body">
                <span className="min-w-0 truncate font-medium text-portal-text">{stage.label}</span>
                <span className="shrink-0 text-right text-portal-muted">
                  {stage.count} · {stage.transition}%
                  {stage.amount ? ` · ${currency.format(stage.amount)}` : ""}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-portal-full bg-portal-surface-secondary">
                <div
                  className="h-full rounded-portal-full bg-gradient-to-r from-portal-primary to-cyan-400"
                  style={{ width: `${Math.max(3, (stage.count / maximum) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Нет данных воронки" size="compact" />
      )}
    </SectionCard>
  );
}
