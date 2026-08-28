"use client";

import Link from "next/link";
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
import { Field, Input, Select } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { shopStageCardHref, shopStageIsFinishedGoods } from "@/lib/production/shop-stage-modules";
import {
  filterTechCardsClient,
  formatTechCardDateTime,
  stageResultStatusLabel,
  stageResultStatusTone,
  techCardModelLabel,
  techCardOrderLabel,
  techCardPositionLabel,
  techCardShopStageStatus,
} from "@/lib/production/tech-cards";
import { techCardVisibleNumber } from "@/lib/production/tech-card-display";
import type { ApiTechnicalCardListItem } from "@/lib/sales/order-tech-cards-api";

const STAGE_STATUS_FILTER_ITEMS: { value: string; label: string }[] = [
  { value: "", label: "Все статусы" },
  { value: "pending", label: "Ожидает" },
  { value: "in_progress", label: "В работе" },
  { value: "completed", label: "Завершён" },
  { value: "skipped", label: "Пропущен" },
];

export function ShopStageQueueWorkspace({
  stageCode,
  stageTitle,
  cards,
}: {
  stageCode: string;
  stageTitle: string;
  cards: ApiTechnicalCardListItem[];
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const isFg = shopStageIsFinishedGoods(stageCode);

  const filtered = useMemo(
    () =>
      filterTechCardsClient(cards, {
        search: query,
        status: statusFilter,
        stage: stageTitle,
        statusField: "stage",
      }),
    [cards, query, stageTitle, statusFilter],
  );

  const cardHref = (cardId: number) => shopStageCardHref(stageCode, cardId);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageToolbar
        start={
          <>
            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-portal-2">
              <div className="shrink-0">
                <p className="text-portal-body font-semibold text-portal-text">
                  {stageTitle}
                </p>
                {isFg ? (
                  <p className="text-portal-caption text-portal-muted">
                    {stageCode === "ready_to_ship"
                      ? "Очередь ГП на складе (не отгружено)"
                      : "Очередь отгрузки / списания со склада"}
                  </p>
                ) : null}
              </div>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по № ТК, заказу, позиции, модели"
                size="compact"
                className="min-w-0 flex-1"
                aria-label={`Поиск очереди ${stageTitle}`}
              />
            </div>
            <Field label="Статус этапа" className="w-full md:w-56">
              <Select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                size="compact"
              >
                {STAGE_STATUS_FILTER_ITEMS.map((item) => (
                  <option key={item.value || "all"} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        }
      />

      <section className="min-h-0 min-w-0 flex-1 overflow-auto bg-portal-surface">
        {filtered.length === 0 ? (
          <EmptyState
            title={`Очередь цеха ${stageTitle} пуста`}
            description="Для этого текущего этапа пока нет техкарт или фильтры сузили выборку."
          />
        ) : (
          <>
            <div className="hidden min-w-0 md:block">
              <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
                <DataTable minWidthClassName="min-w-[920px]">
                  <DataTableHead>
                    <tr>
                      <DataTableHeaderCell className="w-36">№ ТК</DataTableHeaderCell>
                      <DataTableHeaderCell className="w-32">Заказ</DataTableHeaderCell>
                      <DataTableHeaderCell>Позиция</DataTableHeaderCell>
                      <DataTableHeaderCell className="w-44">Модель</DataTableHeaderCell>
                      <DataTableHeaderCell className="w-32">Статус этапа</DataTableHeaderCell>
                      <DataTableHeaderCell className="w-20">Кол-во</DataTableHeaderCell>
                      <DataTableHeaderCell className="w-36">Обновлено</DataTableHeaderCell>
                    </tr>
                  </DataTableHead>
                  <DataTableBody>
                    {filtered.map((card) => {
                      const stageStatus = techCardShopStageStatus(card);
                      return (
                        <DataTableRow key={card.id}>
                          <DataTableCell>
                            <Link
                              href={cardHref(card.id)}
                              className="font-medium text-portal-primary hover:underline"
                            >
                              {techCardVisibleNumber(card)}
                            </Link>
                          </DataTableCell>
                          <DataTableCell>{techCardOrderLabel(card)}</DataTableCell>
                          <DataTableCell>{techCardPositionLabel(card)}</DataTableCell>
                          <DataTableCell className="text-portal-muted">
                            {techCardModelLabel(card)}
                          </DataTableCell>
                          <DataTableCell>
                            <StatusBadge
                              size="compact"
                              tone={stageResultStatusTone(stageStatus)}
                            >
                              {stageResultStatusLabel(stageStatus)}
                            </StatusBadge>
                          </DataTableCell>
                          <DataTableCell className="tabular-nums">{card.quantity}</DataTableCell>
                          <DataTableCell className="text-portal-muted">
                            {formatTechCardDateTime(card.updated_at)}
                          </DataTableCell>
                        </DataTableRow>
                      );
                    })}
                  </DataTableBody>
                </DataTable>
              </DataTableFrame>
            </div>

            <div className="flex flex-col gap-portal-3 p-portal-4 md:hidden">
              {filtered.map((card) => {
                const stageStatus = techCardShopStageStatus(card);
                return (
                  <article
                    key={card.id}
                    className="rounded-portal-md border border-portal-border bg-portal-surface p-portal-4 shadow-portal-card"
                  >
                    <div className="flex items-start justify-between gap-portal-3">
                      <Link
                        href={cardHref(card.id)}
                        className="font-semibold text-portal-primary hover:underline"
                      >
                        {techCardVisibleNumber(card)}
                      </Link>
                      <StatusBadge
                        size="compact"
                        tone={stageResultStatusTone(stageStatus)}
                      >
                        {stageResultStatusLabel(stageStatus)}
                      </StatusBadge>
                    </div>
                    <dl className="mt-portal-3 grid gap-portal-2 text-portal-body">
                      <div className="flex justify-between gap-portal-3">
                        <dt className="text-portal-muted">Заказ</dt>
                        <dd>{techCardOrderLabel(card)}</dd>
                      </div>
                      <div className="flex justify-between gap-portal-3">
                        <dt className="text-portal-muted">Позиция</dt>
                        <dd className="text-right">{techCardPositionLabel(card)}</dd>
                      </div>
                      <div className="flex justify-between gap-portal-3">
                        <dt className="text-portal-muted">Модель</dt>
                        <dd className="text-right">{techCardModelLabel(card)}</dd>
                      </div>
                      <div className="flex justify-between gap-portal-3">
                        <dt className="text-portal-muted">Обновлено</dt>
                        <dd className="text-right">{formatTechCardDateTime(card.updated_at)}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>

            <ListTotals primary={`Показано: ${filtered.length} из ${cards.length} техкарт`} />
          </>
        )}
      </section>
    </div>
  );
}
