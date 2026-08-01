"use client";

import { useMemo, useState } from "react";

import { DashboardFilters } from "./dashboard-filters";
import { DashboardKpiGrid } from "./dashboard-kpi-grid";
import { LeadSourcesTable } from "./lead-sources-table";
import { OrdersSummary } from "./orders-summary";
import { PatternModelSalesPanel } from "./pattern-model-sales-panel";
import { RecentActivity } from "./recent-activity";
import { RejectionReasonsSummary } from "./rejection-reasons-summary";
import { SalesDynamicsChart } from "./sales-dynamics-chart";
import { SalesFunnel } from "./sales-funnel";
import { SalesStatusSummary } from "./sales-status-summary";
import { TasksSummary } from "./tasks-summary";
import { PageContent, PageLayout } from "@/components/layout/page-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { buildDateRange, formatRange } from "@/lib/dashboard/date-range";
import { createSalesDashboardSnapshot } from "@/lib/dashboard/sales-dashboard";
import {
  defaultDashboardFilters,
  type DashboardFilters as Filters,
} from "@/lib/dashboard/sales-dashboard-types";
import { getSalesDashboardDemoData } from "@/lib/demo-data/sales-dashboard";

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** PT-01 reference dashboard (`DS-PT-01`). Demo KPIs + live pattern-model panel (`1.1.5`). */
export function SalesDashboard() {
  const data = useMemo(() => getSalesDashboardDemoData(), []);
  const [filters, setFilters] = useState<Filters>({ ...defaultDashboardFilters });
  const snapshot = useMemo(() => createSalesDashboardSnapshot(data, filters), [data, filters]);
  const liveRange = useMemo(() => {
    const built = buildDateRange(
      filters.period,
      data.now,
      filters.customStart,
      filters.customEnd,
    );
    return {
      from: toIsoDate(built.range.start),
      to: toIsoDate(built.range.end),
      label: formatRange(built.range),
      error: built.error,
    };
  }, [data.now, filters.customEnd, filters.customStart, filters.period]);

  return (
    <PageLayout>
      <PageContent width="full" size="default" className="space-y-portal-5">
        <div className="rounded-portal-md border border-dashed border-portal-warning bg-portal-warning-soft px-portal-3 py-portal-2 text-portal-body text-portal-text">
          <strong className="font-semibold">Смешанный режим.</strong> KPI/воронка —
          демо-снимок; блок «Топ моделей» — живой API (`1.1.5`).
        </div>
        <DashboardFilters
          filters={filters}
          data={data}
          activeLabels={snapshot.activeFilterLabels}
          validationError={snapshot.validationError}
          onChange={setFilters}
        />
        {!liveRange.error ? (
          <PatternModelSalesPanel
            dateFrom={liveRange.from}
            dateTo={liveRange.to}
            rangeLabel={liveRange.label}
          />
        ) : null}
        {snapshot.empty ? (
          <EmptyState
            title="За выбранный период данных нет"
            description="Показатели остаются равными нулю. Измените период или сбросьте фильтры."
          />
        ) : null}
        <DashboardKpiGrid kpis={snapshot.kpis} />
        <div className="grid min-w-0 gap-portal-5 xl:grid-cols-2">
          <SalesFunnel stages={snapshot.funnel} />
          <SalesDynamicsChart points={snapshot.dynamics} />
        </div>
        <div className="grid min-w-0 gap-portal-5 md:grid-cols-2 xl:grid-cols-4">
          <LeadSourcesTable sources={snapshot.sources} />
          <RejectionReasonsSummary reasons={snapshot.rejectionReasons} />
          <SalesStatusSummary statuses={snapshot.dealStatuses} />
          <OrdersSummary orders={snapshot.orders} />
        </div>
        <div className="grid min-w-0 gap-portal-5 xl:grid-cols-3">
          <TasksSummary tasks={snapshot.tasks} />
          <RecentActivity activity={snapshot.activity} />
        </div>
      </PageContent>
    </PageLayout>
  );
}
