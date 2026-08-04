import { Suspense } from "react";

import { DesignProjectsWorkspace } from "@/components/design/design-projects-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import {
  fetchDesignProjects,
  type DesignProjectListItem,
} from "@/lib/design/design-projects";
import { getOrderList } from "@/lib/sales/order-list-api";

type SalesOrderOption = {
  salesOrderId: number;
  salesOrderNumber: string;
  title: string;
};

export default async function DesignProjectsPage() {
  let projects: DesignProjectListItem[] = [];
  let salesOrderOptions: SalesOrderOption[] = [];
  let loadError: string | null = null;
  try {
    projects = await fetchDesignProjects({ limit: 500 });
    const ordersResult = await getOrderList();
    if (ordersResult.ok) {
      salesOrderOptions = ordersResult.orders
        .map((order) => ({
          salesOrderId: order.id,
          salesOrderNumber: order.number,
          title: order.title?.trim() || "",
        }))
        .sort((left, right) =>
          left.salesOrderNumber.localeCompare(right.salesOrderNumber, "ru"),
        );
    }
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Не удалось загрузить дизайн-проекты";
  }

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      {loadError ? (
        <div className="p-portal-6 text-portal-body text-portal-danger" role="alert">
          {loadError}
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="p-portal-6 text-portal-body text-portal-muted">
              Загрузка дизайн-проектов…
            </div>
          }
        >
          <DesignProjectsWorkspace
            projects={projects}
            salesOrderOptions={salesOrderOptions}
          />
        </Suspense>
      )}
    </PageLayout>
  );
}
