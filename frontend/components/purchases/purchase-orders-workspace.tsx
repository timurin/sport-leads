"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { PurchaseOrderCreateDrawer } from "@/components/purchases/purchase-order-create-drawer";
import { PageLayout } from "@/components/layout/page-layout";
import { IconButton } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFrame,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  formatMoneyRub,
  purchaseOrderMatchesQuery,
  purchaseOrderStatusLabel,
  purchaseOrderStatusTone,
  type PurchaseOrderListView,
} from "@/lib/purchases/purchase-orders";

export type SupplierOption = { id: number; name: string };
export type WarehouseOption = { id: number; name: string };

type Props = {
  orders: PurchaseOrderListView[];
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  loadError?: string;
};

/** PT-02 purchase orders list (`DS-PT-02`). */
export function PurchaseOrdersWorkspace({
  orders,
  suppliers,
  warehouses,
  loadError,
}: Props) {
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(
    () => orders.filter((item) => purchaseOrderMatchesQuery(item, query)),
    [orders, query],
  );

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <PageToolbar
        start={(
          <label className="relative flex h-portal-control-default w-full min-w-0 items-center md:min-w-56 md:flex-1 lg:max-w-sm">
            <span className="sr-only">Поиск заказов поставщикам</span>
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск: номер, поставщик"
              aria-label="Поиск заказов поставщикам"
            />
          </label>
        )}
        end={(
          <IconButton
            label="Создать заказ поставщику"
            variant="primary"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-3.5" />
          </IconButton>
        )}
      />

      {loadError ? (
        <InlineAlert
          className="rounded-none border-x-0 border-t-0 border-b"
          tone="danger"
          size="compact"
        >
          {loadError}
        </InlineAlert>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <EmptyState
            title={orders.length === 0 ? "Нет заказов поставщикам" : "Ничего не найдено"}
            description={
              orders.length === 0
                ? "Создайте черновик ЗП (ADR-034). Приход на склад — Stage 13.2.1."
                : "Измените поисковый запрос."
            }
          />
        ) : (
          <DataTableFrame>
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>Номер</DataTableHeaderCell>
                  <DataTableHeaderCell>Поставщик</DataTableHeaderCell>
                  <DataTableHeaderCell>Статус</DataTableHeaderCell>
                  <DataTableHeaderCell>Срок</DataTableHeaderCell>
                  <DataTableHeaderCell>Сумма</DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((order) => (
                  <DataTableRow key={order.id}>
                    <DataTableCell>
                      <Link
                        href={`/purchases/orders/${order.id}`}
                        className="font-medium text-portal-primary hover:underline"
                      >
                        {order.number}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>{order.supplierName}</DataTableCell>
                    <DataTableCell>
                      <StatusBadge
                        tone={purchaseOrderStatusTone(order.status)}
                        size="compact"
                      >
                        {purchaseOrderStatusLabel(order.status)}
                      </StatusBadge>
                    </DataTableCell>
                    <DataTableCell>
                      {order.expectedDate || "—"}
                    </DataTableCell>
                    <DataTableCell>
                      {formatMoneyRub(order.totalAmount)}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
            <ListTotals
              primary={`${filtered.length} из ${orders.length}`}
              secondary="Заказы поставщикам"
            />
          </DataTableFrame>
        )}
      </div>

      <PurchaseOrderCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        suppliers={suppliers}
        warehouses={warehouses}
      />
    </PageLayout>
  );
}
