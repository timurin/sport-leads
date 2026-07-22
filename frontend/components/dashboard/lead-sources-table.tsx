import { currency, salesSourceLabels } from "@/lib/dashboard/sales-dashboard";
import type { SourceSummary } from "@/lib/dashboard/sales-dashboard-types";
import { SectionCard } from "@/components/ui/section-card";

export function LeadSourcesTable({ sources }: { sources: SourceSummary[] }) {
  return (
    <SectionCard
      title="Источники лидов"
      description="Конверсия и выручка по каналам"
      className="md:col-span-2 xl:col-span-2"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-portal-body">
          <thead>
            <tr className="border-b border-portal-border text-portal-caption font-semibold uppercase tracking-wide text-portal-muted">
              <th className="pb-portal-3">Источник</th>
              <th className="pb-portal-3">Лиды</th>
              <th className="pb-portal-3">Успешно</th>
              <th className="pb-portal-3">Отказы</th>
              <th className="pb-portal-3">Конверсия</th>
              <th className="pb-portal-3 text-right">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.source} className="border-b border-portal-border/60 last:border-0">
                <td className="py-portal-3 font-medium text-portal-text">
                  {salesSourceLabels[source.source]}
                </td>
                <td>{source.leads}</td>
                <td>{source.converted}</td>
                <td>{source.rejected}</td>
                <td>{source.conversion}%</td>
                <td className="text-right font-medium">{currency.format(source.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
