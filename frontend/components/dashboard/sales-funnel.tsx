import { SectionCard } from "./section-card";
import { currency } from "@/lib/dashboard/sales-dashboard";
import type { FunnelStage } from "@/lib/dashboard/sales-dashboard-types";

export function SalesFunnel({ stages }: { stages: FunnelStage[] }) {
  const maximum = Math.max(1, ...stages.map((stage) => stage.count));
  return (
    <SectionCard title="Воронка продаж" description="Переходы между ключевыми этапами">
      <div className="space-y-4">
        {stages.map((stage) => (
          <div key={stage.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-700">{stage.label}</span>
              <span className="text-right text-slate-500">{stage.count} · {stage.transition}%{stage.amount ? ` · ${currency.format(stage.amount)}` : ""}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{ width: `${Math.max(3, (stage.count / maximum) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
