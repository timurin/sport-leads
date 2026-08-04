"use client";

import Link from "next/link";

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
import { PageToolbar } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  formatStockDateTime,
  formatStockQuantity,
  stockDocumentStatusLabel,
  stockDocumentStatusTone,
  stockDocumentTypeLabel,
  type StockDocument,
} from "@/lib/stock-documents";

/** Slim PT-07 stock document card (`12.3.3`). */
export function WarehouseMovementDocumentCard({
  document,
  warehouseName,
  nomenclatureNames,
}: {
  document: StockDocument;
  warehouseName: string;
  nomenclatureNames: Record<number, string>;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-portal-4 p-portal-6">
      <PageToolbar
        start={
          <div className="flex min-w-0 flex-col gap-portal-1">
            <Link
              href="/warehouse/movements"
              className="text-portal-caption text-portal-muted hover:text-portal-fg"
            >
              ← Движения
            </Link>
            <div className="flex flex-wrap items-center gap-portal-3">
              <h1 className="text-portal-title font-semibold text-portal-fg">
                {document.number}
              </h1>
              <StatusBadge tone={stockDocumentStatusTone(document.status)}>
                {stockDocumentStatusLabel(document.status)}
              </StatusBadge>
            </div>
            <p className="text-portal-body text-portal-muted">
              {stockDocumentTypeLabel(document.doc_type)} · {warehouseName}
            </p>
          </div>
        }
      />

      <SectionCard title="Реквизиты">
        <dl className="grid gap-portal-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-portal-caption text-portal-muted">Склад</dt>
            <dd className="text-portal-body text-portal-fg">{warehouseName}</dd>
          </div>
          <div>
            <dt className="text-portal-caption text-portal-muted">Проведён</dt>
            <dd className="text-portal-body text-portal-fg">
              {formatStockDateTime(document.posted_at)}
            </dd>
          </div>
          <div>
            <dt className="text-portal-caption text-portal-muted">Создан</dt>
            <dd className="text-portal-body text-portal-fg">
              {formatStockDateTime(document.created_at)}
            </dd>
          </div>
          <div>
            <dt className="text-portal-caption text-portal-muted">Техкарта</dt>
            <dd className="text-portal-body text-portal-fg">
              {document.technical_card_id != null ? (
                <EntityLink
                  href={`/production/tech-cards/${document.technical_card_id}`}
                >
                  ТК #{document.technical_card_id}
                </EntityLink>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-portal-caption text-portal-muted">Заказ</dt>
            <dd className="text-portal-body text-portal-fg">
              {document.sales_order_id != null ? (
                <EntityLink href={`/sales/orders/${document.sales_order_id}`}>
                  Заказ #{document.sales_order_id}
                </EntityLink>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-portal-caption text-portal-muted">Примечание</dt>
            <dd className="text-portal-body text-portal-fg">
              {document.notes?.trim() || "—"}
            </dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard title="Строки регистра">
        {document.ledger_lines.length === 0 ? (
          <EmptyState
            title="Нет строк"
            description="У документа нет проводок регистра."
          />
        ) : (
          <DataTableFrame className="rounded-none border-0 shadow-none">
            <DataTable minWidthClassName="min-w-[640px]">
              <DataTableHead>
                <DataTableHeaderCell>#</DataTableHeaderCell>
                <DataTableHeaderCell>Номенклатура</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Кол-во</DataTableHeaderCell>
                <DataTableHeaderCell>Проведено</DataTableHeaderCell>
              </DataTableHead>
              <DataTableBody>
                {document.ledger_lines.map((line) => (
                  <DataTableRow key={line.id}>
                    <DataTableCell className="text-portal-muted">
                      {line.line_no}
                    </DataTableCell>
                    <DataTableCell>
                      {nomenclatureNames[line.nomenclature_id] ??
                        `#${line.nomenclature_id}`}
                    </DataTableCell>
                    <DataTableCell align="right" className="font-medium">
                      {formatStockQuantity(line.quantity)}
                    </DataTableCell>
                    <DataTableCell className="text-portal-muted">
                      {formatStockDateTime(line.posted_at)}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        )}
      </SectionCard>
    </div>
  );
}
