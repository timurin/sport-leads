import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";

export function RejectionReasonsSummary({
  reasons,
}: {
  reasons: Array<{ reason: string; count: number }>;
}) {
  const maximum = Math.max(1, ...reasons.map((item) => item.count));
  return (
    <SectionCard title="Причины отказов" description="Реальные результаты завершённых лидов">
      {reasons.length ? (
        <div className="space-y-portal-3">
          {reasons.map((item) => (
            <div key={item.reason} className="min-w-0">
              <div className="flex justify-between gap-portal-3 text-portal-body">
                <span className="min-w-0 truncate text-portal-muted">{item.reason}</span>
                <strong className="shrink-0 text-portal-text">{item.count}</strong>
              </div>
              <div className="mt-1 h-2 rounded-portal-full bg-portal-surface-secondary">
                <div
                  className="h-2 rounded-portal-full bg-portal-danger"
                  style={{ width: `${(item.count / maximum) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="За выбранный период отказов нет" size="compact" />
      )}
    </SectionCard>
  );
}
