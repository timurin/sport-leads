"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  fillInventoryDocumentAction,
  postInventoryDocumentAction,
  refreshInventoryBookAction,
  setInventoryCountedAction,
} from "@/app/(workspace)/warehouse/movements/inventory-actions";
import { Button } from "@/components/ui/button";

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
import { Input } from "@/components/ui/form-controls";
import { PageToolbar } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import {
  formatStockDateTime,
  formatStockQuantity,
  inventoryLineDelta,
  isInventoryDocument,
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
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inventory = isInventoryDocument(document);
  const isDraft = document.status === "draft";
  const recountLines = document.inventory_lines ?? [];
  const [countedDraft, setCountedDraft] = useState<Record<number, string>>({});

  useEffect(() => {
    const next: Record<number, string> = {};
    for (const line of document.inventory_lines ?? []) {
      next[line.nomenclature_id] = String(line.counted_qty);
    }
    setCountedDraft(next);
  }, [document.id, document.updated_at]);

  const runInventory = (
    action: () => Promise<
      | { ok: true; document: StockDocument }
      | { ok: false; message: string }
    >,
    success: string,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message);
        pushToast(result.message, "danger");
        return;
      }
      pushToast(success, "success");
      router.refresh();
    });
  };

  const saveCounted = (nomenclatureId: number) => {
    const raw = countedDraft[nomenclatureId];
    if (raw == null) return;
    runInventory(
      () => setInventoryCountedAction(document.id, nomenclatureId, raw),
      "Факт сохранён",
    );
  };

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
        end={
          inventory && isDraft ? (
            <div className="flex flex-wrap items-center gap-portal-2">
              {recountLines.length === 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  disabled={pending}
                  onClick={() =>
                    runInventory(
                      () => fillInventoryDocumentAction(document.id),
                      "Строки заполнены по остаткам",
                    )
                  }
                >
                  Заполнить по остаткам
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  disabled={pending}
                  onClick={() =>
                    runInventory(
                      () => refreshInventoryBookAction(document.id),
                      "Книга обновлена",
                    )
                  }
                >
                  Обновить книгу
                </Button>
              )}
              <Button
                type="button"
                variant="primary"
                size="compact"
                disabled={pending}
                onClick={() =>
                  runInventory(
                    () => postInventoryDocumentAction(document.id),
                    "Инвентаризация проведена",
                  )
                }
              >
                Провести
              </Button>
            </div>
          ) : null
        }
      />

      {error ? (
        <p className="text-portal-caption text-portal-danger" role="alert">
          {error}
        </p>
      ) : null}

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

      {inventory ? (
        <SectionCard title="Пересчёт">
          {recountLines.length === 0 ? (
            <EmptyState
              title="Нет строк пересчёта"
              description="Заполните черновик по остаткам склада или проведите документ без дельт."
            />
          ) : (
            <DataTableFrame className="rounded-none border-0 shadow-none">
              <DataTable minWidthClassName="min-w-[720px]">
                <DataTableHead>
                  <DataTableRow>
                    <DataTableHeaderCell>Номенклатура</DataTableHeaderCell>
                    <DataTableHeaderCell align="right">Книга</DataTableHeaderCell>
                    <DataTableHeaderCell align="right">Факт</DataTableHeaderCell>
                    <DataTableHeaderCell align="right">Дельта</DataTableHeaderCell>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {recountLines.map((line) => {
                    const countedValue =
                      countedDraft[line.nomenclature_id] ??
                      String(line.counted_qty);
                    const name =
                      line.nomenclature_name?.trim() ||
                      nomenclatureNames[line.nomenclature_id] ||
                      `#${line.nomenclature_id}`;
                    return (
                      <DataTableRow key={line.id}>
                        <DataTableCell>{name}</DataTableCell>
                        <DataTableCell align="right" className="text-portal-muted">
                          {formatStockQuantity(line.book_qty)}
                        </DataTableCell>
                        <DataTableCell align="right">
                          {isDraft ? (
                            <Input
                              size="compact"
                              inputMode="decimal"
                              aria-label={`Факт ${name}`}
                              value={countedValue}
                              disabled={pending}
                              className="ml-auto w-28 text-right"
                              onChange={(event) =>
                                setCountedDraft((current) => ({
                                  ...current,
                                  [line.nomenclature_id]: event.target.value,
                                }))
                              }
                              onBlur={() => saveCounted(line.nomenclature_id)}
                            />
                          ) : (
                            formatStockQuantity(line.counted_qty)
                          )}
                        </DataTableCell>
                        <DataTableCell align="right" className="font-medium">
                          {inventoryLineDelta(line.book_qty, countedValue)}
                        </DataTableCell>
                      </DataTableRow>
                    );
                  })}
                </DataTableBody>
              </DataTable>
            </DataTableFrame>
          )}
        </SectionCard>
      ) : null}

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
                <DataTableRow>
                  <DataTableHeaderCell>#</DataTableHeaderCell>
                  <DataTableHeaderCell>Номенклатура</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Кол-во</DataTableHeaderCell>
                  <DataTableHeaderCell>Проведено</DataTableHeaderCell>
                </DataTableRow>
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
