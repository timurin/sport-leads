import { currency, salesSourceLabels } from "@/lib/dashboard/sales-dashboard";
import type { SourceSummary } from "@/lib/dashboard/sales-dashboard-types";
import { SectionCard } from "./section-card";

export function LeadSourcesTable({ sources }: { sources: SourceSummary[] }) {
  return (
    <SectionCard title="Источники лидов" description="Конверсия и выручка по каналам" className="xl:col-span-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="pb-3">Источник</th><th className="pb-3">Лиды</th><th className="pb-3">Успешно</th><th className="pb-3">Отказы</th><th className="pb-3">Конверсия</th><th className="pb-3 text-right">Сумма</th></tr></thead>
          <tbody>{sources.map((source) => <tr key={source.source} className="border-b border-slate-100 last:border-0"><td className="py-3 font-medium text-slate-800">{salesSourceLabels[source.source]}</td><td>{source.leads}</td><td>{source.converted}</td><td>{source.rejected}</td><td>{source.conversion}%</td><td className="text-right font-medium">{currency.format(source.amount)}</td></tr>)}</tbody>
        </table>
      </div>
    </SectionCard>
  );
}
