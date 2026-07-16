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
} from "@/components/kanban/kanban-types";
import { Button } from "@/components/ui/button";
import { DemoActionDialog } from "@/components/ui/demo-action-dialog";
import { PageHeader } from "@/components/ui/page-header";

type KanbanPageProps<TStatus extends string> = {
  title: string;
  description: string;
  actionLabel: string;
  columns: KanbanColumnData<TStatus>[];
  metrics: KanbanMetricDefinition<TStatus>[];
  filters: KanbanFilter[];
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
  description,
  actionLabel,
  columns,
  metrics,
  filters,
}: KanbanPageProps<TStatus>) {
  const [query, setQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [metricColumns, setMetricColumns] = useState(
    () => cloneKanbanColumns(columns),
  );
  const metricCards = useMemo(
    () => metricColumns.flatMap((column) => column.cards),
    [metricColumns],
  );
  const hasFilters = Boolean(query.trim())
    || Object.values(selectedFilters).some(Boolean);

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={(
          <Button variant="primary" onClick={() => setDialogOpen(true)}>
            + {actionLabel}
          </Button>
        )}
      />

      <section className="grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:grid-cols-2 lg:px-6 xl:grid-cols-4" aria-label="Показатели">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-slate-500">{metric.label}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <strong className="text-xl font-semibold text-slate-950">
                {formatMetric(metric, metricCards)}
              </strong>
              {metric.hint ? <span className="text-xs text-slate-400">{metric.hint}</span> : null}
            </div>
          </article>
        ))}
      </section>

      <div className="border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 lg:max-w-sm">
            <Search size={17} className="shrink-0 text-slate-400" />
            <span className="sr-only">Поиск</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Поиск: ${title.toLocaleLowerCase("ru")}`}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>

          {filters.map((filter) => (
            <label key={filter.id} className="sr-only-within">
              <span className="sr-only">{filter.label}</span>
              <select
                value={selectedFilters[filter.id] ?? ""}
                onChange={(event) => setSelectedFilters((current) => ({
                  ...current,
                  [filter.id]: event.target.value,
                }))}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400"
              >
                <option value="">{filter.label}: все</option>
                {filter.options.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          ))}

          {hasFilters ? (
            <Button onClick={() => {
              setQuery("");
              setSelectedFilters({});
            }}>
              <FilterX size={16} />
              Сбросить
            </Button>
          ) : null}
        </div>
      </div>

      <div className="p-4 lg:p-6">
        <KanbanBoard
          columns={columns}
          query={query}
          selectedFilters={selectedFilters}
          onColumnsChange={setMetricColumns}
        />
      </div>
      <DemoActionDialog
        open={dialogOpen}
        title={actionLabel}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
