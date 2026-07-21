"use client";

import { useMemo, useState } from "react";

import { DashboardFilters } from "./dashboard-filters";
import { DashboardKpiGrid } from "./dashboard-kpi-grid";
import { LeadSourcesTable } from "./lead-sources-table";
import { OrdersSummary } from "./orders-summary";
import { RecentActivity } from "./recent-activity";
import { RejectionReasonsSummary } from "./rejection-reasons-summary";
import { SalesDynamicsChart } from "./sales-dynamics-chart";
import { SalesFunnel } from "./sales-funnel";
import { SalesStatusSummary } from "./sales-status-summary";
import { TasksSummary } from "./tasks-summary";
import { createSalesDashboardSnapshot } from "@/lib/dashboard/sales-dashboard";
import { defaultDashboardFilters, type DashboardFilters as Filters } from "@/lib/dashboard/sales-dashboard-types";
import { getSalesDashboardDemoData } from "@/lib/demo-data/sales-dashboard";

export function SalesDashboard() {
  const data = useMemo(() => getSalesDashboardDemoData(), []);
  const [filters, setFilters] = useState<Filters>({ ...defaultDashboardFilters });
  const snapshot = useMemo(() => createSalesDashboardSnapshot(data, filters), [data, filters]);

  return (
    <div className="min-w-0">
      <div className="space-y-5 p-4 sm:p-6">
        <DashboardFilters filters={filters} data={data} activeLabels={snapshot.activeFilterLabels} validationError={snapshot.validationError} onChange={setFilters} />
        {snapshot.empty ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center"><h2 className="font-semibold text-slate-800">За выбранный период данных нет</h2><p className="mt-1 text-sm text-slate-500">Показатели остаются равными нулю. Измените период или сбросьте фильтры.</p></div> : null}
        <DashboardKpiGrid kpis={snapshot.kpis} />
        <div className="grid min-w-0 gap-5 xl:grid-cols-2"><SalesFunnel stages={snapshot.funnel} /><SalesDynamicsChart points={snapshot.dynamics} /></div>
        <div className="grid min-w-0 gap-5 xl:grid-cols-4"><LeadSourcesTable sources={snapshot.sources} /><RejectionReasonsSummary reasons={snapshot.rejectionReasons} /><SalesStatusSummary statuses={snapshot.dealStatuses} /><OrdersSummary orders={snapshot.orders} /></div>
        <div className="grid min-w-0 gap-5 xl:grid-cols-3"><TasksSummary tasks={snapshot.tasks} /><RecentActivity activity={snapshot.activity} /></div>
      </div>
    </div>
  );
}
