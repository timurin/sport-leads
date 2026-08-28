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
import { MetricCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import {
  countProductionOrdersByStatus,
  filterProductionOrdersClient,
  PRODUCTION_ORDER_STATUS_KPI,
  productionOrderStatusLabel,
  productionOrderStatusTone,
  type ProductionOrderListItem,
} from "@/lib/production/production-orders";
import { SHOP_STAGE_MODULES } from "@/lib/production/shop-stage-modules";

type SalesOrderOption = {
  salesOrderId: number;
  salesOrderNumber: string;
  technicalCardCount: number;
};

type TechCardQuickItem = {
  id: number;
  number: string;
  status: string;
};

type StandaloneGroupOption = {
  orderGroupId: number;
  orderNumber: string;
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
  standaloneGroupOptions,
  techCardsQuick,
}: {
  orders: ProductionOrderListItem[];
  salesOrderOptions: SalesOrderOption[];
  standaloneGroupOptions: StandaloneGroupOption[];
  techCardsQuick: TechCardQuickItem[];
}) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [sourceKind, setSourceKind] = useState<"sales" | "group">("sales");
  const [salesOrderId, setSalesOrderId] = useState("");
  const [orderGroupId, setOrderGroupId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const byQuery = filterProductionOrdersClient(orders, query);
    if (!statusFilter) return byQuery;
    return byQuery.filter((row) => row.status === statusFilter);
  }, [orders, query, statusFilter]);

  const statusCounts = useMemo(
    () => countProductionOrdersByStatus(orders),
    [orders],
  );

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    const salesId = Number(salesOrderId.trim());
    const groupId = Number(orderGroupId.trim());
    if (sourceKind === "sales") {
      if (!Number.isSafeInteger(salesId) || salesId <= 0) {
        setError("Выберите заказ покупателя");
        return;
      }
    } else if (!Number.isSafeInteger(groupId) || groupId <= 0) {
      setError("Выберите standalone-группу");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createProductionOrderAction({
      sales_order_id: sourceKind === "sales" ? salesId : undefined,
      order_group_id: sourceKind === "group" ? groupId : undefined,
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
    setOrderGroupId("");
    setSourceKind("sales");
    setNotes("");
    router.push(`/production/orders/${result.order.id}`);
    router.refresh();
  };

  return (
    <div className="sl-design-v1 flex min-h-0 min-w-0 flex-1 flex-col gap-3 bg-portal-page p-portal-4 text-portal-text">
      <CreateDrawer
        open={createOpen}
        title="Новый производственный заказ"
        description="Планировочный документ Производства: заказ покупателя или standalone-группа."
        onClose={() => {
          if (saving) return;
          setCreateOpen(false);
          setError(null);
        }}
        variant="overlay"
      >
        <form
          onSubmit={onCreate}
          className="flex h-full min-h-0 flex-col"
          data-standalone-production-order-create
        >
          <div className="min-h-0 flex-1 space-y-portal-4 overflow-y-auto p-portal-6">
            <Field label="Источник" required>
              <Select
                autoFocus
                value={sourceKind}
                onChange={(event) => {
                  const next = event.target.value === "group" ? "group" : "sales";
                  setSourceKind(next);
                  setError(null);
                }}
                disabled={saving}
              >
                <option value="sales">Заказ покупателя</option>
                <option value="group">Standalone-группа</option>
              </Select>
            </Field>
            {sourceKind === "sales" ? (
              <Field label="Заказ покупателя" required>
                <Select
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
            ) : (
              <Field label="Standalone-группа" required>
                <Select
                  required
                  value={orderGroupId}
                  onChange={(event) => setOrderGroupId(event.target.value)}
                  disabled={saving}
                >
                  <option value="">Выберите группу…</option>
                  {standaloneGroupOptions.map((option) => (
                    <option key={option.orderGroupId} value={option.orderGroupId}>
                      {option.orderNumber} · техкарты: {option.technicalCardCount}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Примечание">
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={saving}
              />
            </Field>
            {sourceKind === "sales" && salesOrderOptions.length === 0 ? (
              <p className="text-portal-caption text-portal-muted">
                Нет заказов покупателя с техкартами. Сначала создайте техкарты в
                production/tech-cards.
              </p>
            ) : null}
            {sourceKind === "group" && standaloneGroupOptions.length === 0 ? (
              <p className="text-portal-caption text-portal-muted">
                Нет standalone-групп. Сначала создайте самостоятельную техкарту.
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

      <section className="sl-soft-panel flex flex-wrap items-start justify-between gap-3 p-portal-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              Заказы в производстве
            </h1>
            <span className="rounded-full border border-portal-border px-2 py-0.5 text-portal-caption text-portal-muted">
              {orders.length} всего
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/production/kanban"
            className="portal-focus-ring inline-flex h-9 items-center justify-center rounded-lg border border-portal-border bg-portal-surface px-3 text-sm font-medium text-portal-text"
          >
            Канбан
          </Link>
          <IconButton
            label="Создать производственный заказ"
            variant="primary"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {PRODUCTION_ORDER_STATUS_KPI.map((item) => (
          <MetricCard
            key={item.status}
            label={item.label}
            value={String(statusCounts[item.status])}
            size="compact"
          />
        ))}
      </div>

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
          </div>
        }
      />

      <section className="sl-soft-panel min-h-0 min-w-0 flex-1 overflow-auto bg-portal-surface">
        {filtered.length === 0 ? (
          <EmptyState
            title="Нет производственных заказов"
            description="Создайте заказ производства по заказу покупателя или standalone-группе."
          />
        ) : (
          <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Номер</DataTableHeaderCell>
                  <DataTableHeaderCell>Заказ / группа</DataTableHeaderCell>
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
                      {row.sales_order_id != null ? (
                        <Link
                          href={`/sales/orders/${row.sales_order_id}`}
                          className="text-portal-primary hover:underline"
                        >
                          {row.sales_order_number?.trim() || `#${row.sales_order_id}`}
                        </Link>
                      ) : (
                        row.sales_order_number?.trim() || "Standalone"
                      )}
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

      <div className="grid gap-3 md:grid-cols-2">
        <section className="sl-soft-panel p-portal-4">
          <h2 className="mb-3 text-sm font-semibold">Цеховые этапы</h2>
          <div className="grid grid-cols-2 gap-2">
            {SHOP_STAGE_MODULES.map((stage) => (
              <Link
                key={stage.code}
                href={stage.href}
                className="rounded-portal-lg border border-portal-border bg-portal-surface px-3 py-2 text-sm font-medium text-portal-text hover:bg-portal-state-hover"
              >
                {stage.title}
              </Link>
            ))}
          </div>
        </section>
        <section className="sl-soft-panel p-portal-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Техкарты · быстрый доступ</h2>
            <Link
              href="/production/tech-cards"
              className="text-portal-caption font-medium text-portal-primary hover:underline"
            >
              Все
            </Link>
          </div>
          {techCardsQuick.length === 0 ? (
            <p className="text-portal-caption text-portal-muted">
              Нет технических карт.
            </p>
          ) : (
            <ul className="space-y-2">
              {techCardsQuick.map((card) => (
                <li
                  key={card.id}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{card.number}</div>
                    <div className="text-portal-caption text-portal-muted">
                      {card.status}
                    </div>
                  </div>
                  <Link
                    href={`/production/tech-cards/${card.id}`}
                    className="portal-focus-ring shrink-0 rounded-lg border border-portal-border px-2 py-1 text-portal-caption font-medium"
                  >
                    Открыть
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
