import { ResponsiveGrid } from "@/components/layout/page-layout";
import { MetricCard } from "@/components/ui/section-card";
import type { Kpi } from "@/lib/dashboard/sales-dashboard-types";

export function DashboardKpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <ResponsiveGrid minItemWidth="small" gap="default">
      {kpis.map((kpi) => {
        const tone =
          kpi.tone === "positive" ? "success" : kpi.tone === "negative" ? "danger" : "default";
        const changeLabel = `${kpi.change > 0 ? "+" : ""}${kpi.change}%`;
        return (
          <MetricCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            tone={tone}
            detail={`${changeLabel} · ${kpi.hint}`}
          />
        );
      })}
    </ResponsiveGrid>
  );
}
