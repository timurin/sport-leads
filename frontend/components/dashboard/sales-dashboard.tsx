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
import { PageContent, PageLayout } from "@/components/layout/page-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { createSalesDashboardSnapshot } from "@/lib/dashboard/sales-dashboard";
import { defaultDashboardFilters, type DashboardFilters as Filters } from "@/lib/dashboard/sales-dashboard-types";
import { getSalesDashboardDemoData } from "@/lib/demo-data/sales-dashboard";

/** PT-01 reference dashboard (`DS-PT-01`). Demo data — Stage `5.6.1` migration complete. */
export function SalesDashboard() {
  const data = useMemo(() => getSalesDashboardDemoData(), []);
  const [filters, setFilters] = useState<Filters>({ ...defaultDashboardFilters });
  const snapshot = useMemo(() => createSalesDashboardSnapshot(data, filters), [data, filters]);

  return (
    <PageLayout>
      <PageContent width="full" size="default" className="space-y-portal-5">
        <div className="rounded-portal-md border border-dashed border-portal-warning bg-portal-warning-soft px-portal-3 py-portal-2 text-portal-body text-portal-text">
          <strong className="font-semibold">Демо-аналитика.</strong> Показатели
          рассчитываются из локального снимка; подключение к API — отдельный этап
          roadmap.
        </div>
        <DashboardFilters
          filters={filters}
          data={data}
          activeLabels={snapshot.activeFilterLabels}
          validationError={snapshot.validationError}
          onChange={setFilters}
        />
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
