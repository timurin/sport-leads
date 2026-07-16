import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import type { Kpi } from "@/lib/dashboard/sales-dashboard-types";

export function DashboardKpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = kpi.tone === "positive" ? ArrowUpRight : kpi.tone === "negative" ? ArrowDownRight : ArrowRight;
        const tone = kpi.tone === "positive" ? "text-emerald-600 bg-emerald-50" : kpi.tone === "negative" ? "text-red-600 bg-red-50" : "text-slate-500 bg-slate-100";
        return (
          <article key={kpi.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{kpi.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{kpi.value}</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">{kpi.hint}</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>
                <Icon size={13} /> {kpi.change > 0 ? "+" : ""}{kpi.change}%
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
