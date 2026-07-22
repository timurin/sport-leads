"use client";

import { FilterX, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { KanbanBoard } from "@/components/kanban/kanban-board";
import {
  cloneKanbanColumns,
} from "@/components/kanban/kanban-state";
import type {
  KanbanCardData,
  KanbanColumnData,
  KanbanFilter,
  KanbanMetricDefinition,
  KanbanMove,
} from "@/components/kanban/kanban-types";
import { PageLayout, ResponsiveGrid } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { DemoCreateDrawer } from "@/components/ui/demo-create-drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import { PageToolbar } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/section-card";

type KanbanPageProps<TStatus extends string> = {
  title: string;
  description: string;
  actionLabel: string;
  columns: KanbanColumnData<TStatus>[];
  metrics: KanbanMetricDefinition<TStatus>[];
  filters: KanbanFilter[];
  loadError?: string;
  onMove?: (move: KanbanMove<TStatus>) => Promise<{ ok: boolean; message: string }>;
};

type MetricSelection<TStatus extends string> = {
  statuses?: readonly TStatus[];
  excludeStatuses?: readonly TStatus[];
};

function selectCards<TStatus extends string>(
  cards: KanbanCardData<TStatus>[],
  selection: MetricSelection<TStatus>,
) {
  return cards.filter((card) => {
    const included = !selection.statuses
      || selection.statuses.includes(card.status);
    const excluded = selection.excludeStatuses?.includes(card.status) ?? false;
    return included && !excluded;
  });
}

function formatMetric<TStatus extends string>(
  metric: KanbanMetricDefinition<TStatus>,
  cards: KanbanCardData<TStatus>[],
): string {
  if (metric.kind === "count") {
    return String(selectCards(cards, metric).length);
  }

  if (metric.kind === "sum") {
    const value = selectCards(cards, metric).reduce(
      (total, card) => total + (card.metricValues?.[metric.valueKey] ?? 0),
      0,
    );

    return metric.format === "currency"
      ? `${new Intl.NumberFormat("ru-RU").format(value)} ₽`
      : new Intl.NumberFormat("ru-RU").format(value);
  }

  const numerator = selectCards(cards, metric.numerator).length;
  const denominator = selectCards(cards, metric.denominator).length;
  return `${denominator ? Math.round((numerator / denominator) * 100) : 0}%`;
}

export function KanbanPage<TStatus extends string>({
  title,
  description: _description,
  actionLabel,
  columns,
  metrics,
  filters,
  loadError,
  onMove,
}: KanbanPageProps<TStatus>) {
  const [query, setQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [metricColumns, setMetricColumns] = useState(
    () => cloneKanbanColumns(columns),
  );
  const [boardRevision, setBoardRevision] = useState(0);
  const [moveError, setMoveError] = useState<string | null>(null);
  const metricCards = useMemo(
    () => metricColumns.flatMap((column) => column.cards),
    [metricColumns],
  );
  const hasFilters = Boolean(query.trim())
    || Object.values(selectedFilters).some(Boolean);

  return (
    <PageLayout>
      <PageToolbar
        start={(
          <>
            <label className="relative flex h-portal-control-default w-full min-w-0 items-center md:min-w-56 md:flex-1 lg:max-w-sm">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-portal-muted"
              />
              <span className="sr-only">Поиск</span>
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Поиск: ${title.toLocaleLowerCase("ru")}`}
                className="pl-9"
                aria-label={`Поиск: ${title}`}
              />
            </label>

            {filters.map((filter) => (
              <Select
                key={filter.id}
                className="w-full md:w-auto md:min-w-40"
                value={selectedFilters[filter.id] ?? ""}
                onChange={(event) => setSelectedFilters((current) => ({
                  ...current,
                  [filter.id]: event.target.value,
                }))}
                aria-label={filter.label}
              >
                <option value="">{filter.label}: все</option>
                {filter.options.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
            ))}

            {hasFilters ? (
              <Button
                type="button"
                className="w-full md:w-auto"
                onClick={() => {
                  setQuery("");
                  setSelectedFilters({});
                }}
              >
                <FilterX size={16} />
                Сбросить
              </Button>
            ) : null}
          </>
        )}
        end={(
          <Button variant="primary" className="w-full sm:w-auto" onClick={() => setDialogOpen(true)}>
            {actionLabel}
          </Button>
        )}
      />

      <section
        className="border-b border-portal-border bg-portal-surface-secondary px-portal-4 py-portal-4 lg:px-portal-6"
        aria-label="Показатели"
      >
        <ResponsiveGrid minItemWidth="small" gap="default">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={formatMetric(metric, metricCards)}
              detail={metric.hint}
            />
          ))}
        </ResponsiveGrid>
      </section>

      <div className="min-w-0 p-portal-4 lg:p-portal-6">
        {moveError ? (
          <InlineAlert className="mb-portal-4" tone="danger">
            {moveError}
          </InlineAlert>
        ) : null}
        {loadError ? (
          <EmptyState
            title="Не удалось загрузить доску"
            description={loadError}
            size="default"
          />
        ) : (
          <KanbanBoard
            key={boardRevision}
            columns={metricColumns}
            query={query}
            selectedFilters={selectedFilters}
            onColumnsChange={setMetricColumns}
            onMove={(move) => {
              if (!onMove) {
                return;
              }

              const previousColumns = cloneKanbanColumns(metricColumns);
              const previousCard = previousColumns
                .flatMap((column) => column.cards)
                .find((card) => card.id === move.cardId);
              if (!previousCard || previousCard.status === move.targetColumnId) {
                return;
              }

              setMoveError(null);
              void onMove(move).then((result) => {
                if (result.ok) {
                  return;
                }

                setMetricColumns(previousColumns);
                setBoardRevision((value) => value + 1);
                setMoveError(`Не удалось сохранить статус заказа: ${result.message}`);
              }).catch(() => {
                setMetricColumns(previousColumns);
                setBoardRevision((value) => value + 1);
                setMoveError("Не удалось связаться с backend. Перемещение заказа отменено.");
              });
            }}
          />
        )}
      </div>
      <DemoCreateDrawer
        open={dialogOpen}
        title={actionLabel}
        onClose={() => setDialogOpen(false)}
      />
    </PageLayout>
  );
}
