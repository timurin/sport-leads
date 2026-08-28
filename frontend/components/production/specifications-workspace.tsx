"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { PageLayout } from "@/components/layout/page-layout";
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
  specificationMatchesQuery,
  specificationStatusLabel,
  specificationStatusTone,
  type SpecificationListItem,
} from "@/lib/production/specifications";

type Props = {
  specifications: SpecificationListItem[];
  loadError?: string;
};

/** PT-02 list (`DS-PT-02`) for specification report documents. */
export function SpecificationsWorkspace({ specifications, loadError }: Props) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      specifications.filter((item) => specificationMatchesQuery(item, query)),
    [specifications, query],
  );

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <PageToolbar
        start={(
          <label className="relative flex h-portal-control-default w-full min-w-0 items-center md:min-w-56 md:flex-1 lg:max-w-sm">
            <span className="sr-only">Поиск спецификаций</span>
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск: номер, партия, заказ"
              aria-label="Поиск спецификаций"
            />
          </label>
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

      <div className="min-w-0 flex-1 p-portal-4 lg:p-portal-6">
        {filtered.length === 0 ? (
          <EmptyState
            title={
              specifications.length === 0
                ? "Спецификаций пока нет"
                : "Ничего не найдено"
            }
            description={
              specifications.length === 0
                ? "Создайте спецификацию из карточки партии. Demo-записи не подставляются."
                : "Измените поисковый запрос."
            }
            size="compact"
            action={
              specifications.length === 0 ? (
                <Link
                  href="/production/orders"
                  className="text-portal-body text-portal-primary hover:underline"
                >
                  К производственным заказам
                </Link>
              ) : null
            }
          />
        ) : (
          <DataTableFrame>
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>Номер</DataTableHeaderCell>
                  <DataTableHeaderCell>Партия</DataTableHeaderCell>
                  <DataTableHeaderCell>Заказ / группа</DataTableHeaderCell>
                  <DataTableHeaderCell>Производственный заказ</DataTableHeaderCell>
                  <DataTableHeaderCell>Версия</DataTableHeaderCell>
                  <DataTableHeaderCell>Статус</DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((item) => (
                  <DataTableRow key={item.id}>
                    <DataTableCell className="font-medium text-portal-text">
                      <Link
                        href={`/production/specifications/${item.id}`}
                        className="text-portal-primary hover:underline"
                      >
                        {item.number}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>
                      {item.production_batch_number?.trim() ||
                        `#${item.production_batch_id}`}
                    </DataTableCell>
                    <DataTableCell>
                      {item.sales_order_id != null ? (
                        <Link
                          href={`/sales/orders/${item.sales_order_id}`}
                          className="text-portal-primary hover:underline"
                        >
                          {item.sales_order_number?.trim() ||
                            `#${item.sales_order_id}`}
                        </Link>
                      ) : (
                        <span data-standalone-specification-order>
                          {item.sales_order_number?.trim() || "Standalone"}
                        </span>
                      )}
                    </DataTableCell>
                    <DataTableCell>
                      <Link
                        href={`/production/orders/${item.production_order_id}`}
                        className="text-portal-primary hover:underline"
                      >
                        {item.production_order_number?.trim() ||
                          `#${item.production_order_id}`}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>
                      {item.current_version_no != null
                        ? `v${item.current_version_no}`
                        : "—"}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge
                        size="compact"
                        tone={specificationStatusTone(item.current_version_status)}
                      >
                        {specificationStatusLabel(item.current_version_status)}
                      </StatusBadge>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
            <ListTotals
              primary={`${filtered.length} из ${specifications.length}`}
              secondary="Документы-отчёты партий"
            />
          </DataTableFrame>
        )}
      </div>
    </PageLayout>
  );
}
