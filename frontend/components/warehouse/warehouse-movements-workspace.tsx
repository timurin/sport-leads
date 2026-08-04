"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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
import { Input, Select } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  filterStockDocumentsClient,
  formatStockDateTime,
  stockDocumentStatusLabel,
  stockDocumentStatusTone,
  stockDocumentTypeLabel,
  type StockDocument,
} from "@/lib/stock-documents";

const DOC_TYPE_FILTER: { value: string; label: string }[] = [
  { value: "", label: "Все типы" },
  { value: "receipt", label: "Приход" },
  { value: "issue", label: "Списание" },
  { value: "fg_receipt", label: "Приход ГП" },
  { value: "fg_issue", label: "Списание ГП" },
];

const STATUS_FILTER: { value: string; label: string }[] = [
  { value: "", label: "Все статусы" },
  { value: "posted", label: "Проведён" },
  { value: "draft", label: "Черновик" },
  { value: "cancelled", label: "Отменён" },
];

/** PT-02 warehouse stock movements journal (`12.3.3`). */
export function WarehouseMovementsWorkspace({
  documents,
  warehouseNames,
}: {
  documents: StockDocument[];
  warehouseNames: Record<number, string>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = useMemo(() => {
    let rows = filterStockDocumentsClient(documents, query);
    if (docTypeFilter) {
      rows = rows.filter((row) => row.doc_type === docTypeFilter);
    }
    if (statusFilter) {
      rows = rows.filter((row) => row.status === statusFilter);
    }
    return rows;
  }, [documents, docTypeFilter, query, statusFilter]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageToolbar
        start={
          <div className="flex min-w-0 w-full flex-col gap-portal-2 md:flex-row md:items-center">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по номеру / типу / ТК / заказу"
              size="compact"
              className="min-w-0 w-full flex-1"
              aria-label="Поиск складских документов"
            />
            <Select
              value={docTypeFilter}
              onChange={(event) => setDocTypeFilter(event.target.value)}
              size="compact"
              className="w-full md:w-44"
              aria-label="Фильтр по типу"
            >
              {DOC_TYPE_FILTER.map((item) => (
                <option key={item.value || "all-types"} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              size="compact"
              className="w-full md:w-40"
              aria-label="Фильтр по статусу"
            >
              {STATUS_FILTER.map((item) => (
                <option key={item.value || "all-status"} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="Нет складских документов"
          description="Приходы и списания появятся после проводок и завершения стадий ГП."
        />
      ) : (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <DataTableFrame className="min-h-0 flex-1 rounded-none border-x-0 shadow-none">
            <DataTable minWidthClassName="min-w-[960px]">
              <DataTableHead>
                <DataTableHeaderCell>Номер</DataTableHeaderCell>
                <DataTableHeaderCell>Тип</DataTableHeaderCell>
                <DataTableHeaderCell>Статус</DataTableHeaderCell>
                <DataTableHeaderCell>Склад</DataTableHeaderCell>
                <DataTableHeaderCell>Проведён</DataTableHeaderCell>
                <DataTableHeaderCell>ТК</DataTableHeaderCell>
                <DataTableHeaderCell>Заказ</DataTableHeaderCell>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((row) => (
                  <DataTableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(`/warehouse/movements/${row.id}`)
                    }
                  >
                    <DataTableCell className="font-semibold">
                      <EntityLink href={`/warehouse/movements/${row.id}`}>
                        {row.number}
                      </EntityLink>
                    </DataTableCell>
                    <DataTableCell>
                      {stockDocumentTypeLabel(row.doc_type)}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge tone={stockDocumentStatusTone(row.status)}>
                        {stockDocumentStatusLabel(row.status)}
                      </StatusBadge>
                    </DataTableCell>
                    <DataTableCell className="text-portal-muted">
                      {warehouseNames[row.warehouse_id] ??
                        `#${row.warehouse_id}`}
                    </DataTableCell>
                    <DataTableCell className="whitespace-nowrap text-portal-muted">
                      {formatStockDateTime(row.posted_at)}
                    </DataTableCell>
                    <DataTableCell className="text-portal-muted">
                      {row.technical_card_id != null
                        ? `#${row.technical_card_id}`
                        : "—"}
                    </DataTableCell>
                    <DataTableCell className="text-portal-muted">
                      {row.sales_order_id != null
                        ? `#${row.sales_order_id}`
                        : "—"}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
          <ListTotals primary={`Всего: ${filtered.length} документов`} />
        </section>
      )}
    </div>
  );
}
