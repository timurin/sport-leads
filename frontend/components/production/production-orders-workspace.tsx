"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";

import { createProductionOrderAction } from "@/app/(workspace)/production/orders/production-order-actions";
import { Button, IconButton } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
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
import { EntityLink } from "@/components/ui/entity-link";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import {
  filterProductionOrdersClient,
  productionOrderStatusLabel,
  productionOrderStatusTone,
  type ProductionOrderListItem,
} from "@/lib/production/production-orders";

type SalesOrderOption = {
  salesOrderId: number;
  salesOrderNumber: string;
  technicalCardCount: number;
};

const STATUS_FILTER_ITEMS: { value: string; label: string }[] = [
  { value: "", label: "Все статусы" },
  { value: "draft", label: "Черновик" },
  { value: "in_progress", label: "В работе" },
  { value: "completed", label: "Завершён" },
  { value: "cancelled", label: "Отменён" },
];

/** PT-02 production orders list. */
export function ProductionOrdersWorkspace({
  orders,
  salesOrderOptions,
}: {
  orders: ProductionOrderListItem[];
  salesOrderOptions: SalesOrderOption[];
}) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [salesOrderId, setSalesOrderId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const byQuery = filterProductionOrdersClient(orders, query);
    if (!statusFilter) return byQuery;
    return byQuery.filter((row) => row.status === statusFilter);
  }, [orders, query, statusFilter]);

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    const id = Number(salesOrderId.trim());
    if (!Number.isSafeInteger(id) || id <= 0) {
      setError("Выберите заказ покупателя");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createProductionOrderAction({
      sales_order_id: id,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    pushToast("Производственный заказ создан", "success");
    setCreateOpen(false);
    setSalesOrderId("");
    setNotes("");
    router.push(`/production/orders/${result.order.id}`);
    router.refresh();
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <CreateDrawer
        open={createOpen}
        title="Новый производственный заказ"
        description="Планировочный документ Производства по заказу покупателя (ADR-018)."
        onClose={() => {
          if (saving) return;
          setCreateOpen(false);
          setError(null);
        }}
        variant="overlay"
      >
        <form onSubmit={onCreate} className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1 space-y-portal-4 overflow-y-auto p-portal-6">
            <Field label="Заказ покупателя" required>
              <Select
                autoFocus
                required
                value={salesOrderId}
                onChange={(event) => setSalesOrderId(event.target.value)}
                disabled={saving}
              >
                <option value="">Выберите заказ…</option>
                {salesOrderOptions.map((option) => (
                  <option key={option.salesOrderId} value={option.salesOrderId}>
                    {option.salesOrderNumber} · техкарты: {option.technicalCardCount}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Примечание">
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={saving}
              />
            </Field>
            {salesOrderOptions.length === 0 ? (
              <p className="text-portal-caption text-portal-muted">
                Нет заказов покупателя с техкартами. Сначала создайте техкарты в
                `production/tech-cards`.
              </p>
            ) : null}
            {error ? (
              <p className="text-portal-body text-portal-danger" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <footer className="flex justify-end gap-portal-2 border-t border-portal-border bg-portal-surface px-portal-6 py-portal-4">
            <Button
              type="button"
              onClick={() => setCreateOpen(false)}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Создание…" : "Создать"}
            </Button>
          </footer>
        </form>
      </CreateDrawer>

      <PageToolbar
        start={
          <div className="flex min-w-0 w-full flex-col gap-portal-2 md:flex-row md:items-center">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по № ПО / заказу"
              size="compact"
              className="min-w-0 w-full flex-1"
              aria-label="Поиск производственных заказов"
            />
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              size="compact"
              className="w-full md:w-48"
              aria-label="Фильтр по статусу"
            >
              {STATUS_FILTER_ITEMS.map((item) => (
                <option key={item.value || "all"} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
            <IconButton
              label="Создать производственный заказ"
              variant="primary"
              className="self-start flex-none"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        }
      />

      <section className="min-h-0 min-w-0 flex-1 overflow-auto bg-portal-surface">
        {filtered.length === 0 ? (
          <EmptyState
            title="Нет производственных заказов"
            description="Создайте заказ производства по ID заказа покупателя."
          />
        ) : (
          <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Номер</DataTableHeaderCell>
                  <DataTableHeaderCell>Заказ покупателя</DataTableHeaderCell>
                  <DataTableHeaderCell>Статус</DataTableHeaderCell>
                  <DataTableHeaderCell>Партии</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((row) => (
                  <DataTableRow key={row.id}>
                    <DataTableCell>
                      <EntityLink href={`/production/orders/${row.id}`}>
                        {row.number}
                      </EntityLink>
                    </DataTableCell>
                    <DataTableCell>
                      <Link
                        href={`/sales/orders/${row.sales_order_id}`}
                        className="text-portal-primary hover:underline"
                      >
                        {row.sales_order_number?.trim() || `#${row.sales_order_id}`}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge
                        size="compact"
                        tone={productionOrderStatusTone(row.status)}
                      >
                        {productionOrderStatusLabel(row.status)}
                      </StatusBadge>
                    </DataTableCell>
                    <DataTableCell>{row.batch_count}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
            <ListTotals primary={`Всего: ${filtered.length} заказов`} />
          </DataTableFrame>
        )}
      </section>
    </div>
  );
}
