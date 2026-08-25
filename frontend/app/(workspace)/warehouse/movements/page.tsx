import { Suspense } from "react";

import { WarehouseMovementsWorkspace } from "@/components/warehouse/warehouse-movements-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import {
  listStockDocuments,
  type StockDocument,
} from "@/lib/stock-documents";
import { getWarehouses, type Warehouse } from "@/lib/warehouses";

export default async function WarehouseMovementsPage() {
  let loadError: string | null = null;
  let documents: StockDocument[] = [];
  const warehouseNames: Record<number, string> = {};
  let warehouses: Warehouse[] = [];

  try {
    const [docs, warehouseRows] = await Promise.all([
      listStockDocuments({ limit: 500 }),
      getWarehouses({ limit: 500 }),
    ]);
    documents = docs;
    warehouses = warehouseRows;
    for (const warehouse of warehouseRows) {
      warehouseNames[warehouse.id] = warehouse.name;
    }
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Не удалось загрузить складские движения";
  }

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      {loadError ? (
        <div
          className="p-portal-6 text-portal-body text-portal-danger"
          role="alert"
        >
          {loadError}
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="p-portal-6 text-portal-body text-portal-muted">
              Загрузка движений…
            </div>
          }
        >
          <WarehouseMovementsWorkspace
            documents={documents}
            warehouseNames={warehouseNames}
            warehouses={warehouses}
          />
        </Suspense>
      )}
    </PageLayout>
  );
}
