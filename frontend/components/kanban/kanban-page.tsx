"use client";

import { FilterX, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { KanbanBoard } from "@/components/kanban/kanban-board";
import type { KanbanColumnData, KanbanFilter, KanbanMetric } from "@/components/kanban/kanban-types";
import { Button } from "@/components/ui/button";
import { DemoActionDialog } from "@/components/ui/demo-action-dialog";
import { PageHeader } from "@/components/ui/page-header";

type KanbanPageProps = {
  title: string;
  description: string;
  actionLabel: string;
  columns: KanbanColumnData[];
  metrics: KanbanMetric[];
  filters: KanbanFilter[];
};

const cardSearchText = (card: KanbanColumnData["cards"][number]) => [
  card.title,
  card.subtitle,
  card.amount,
  card.responsible,
  card.nextAction,
  ...(card.details?.flatMap((detail) => [detail.label, detail.value]) ?? []),
].filter(Boolean).join(" ").toLocaleLowerCase("ru");

export function KanbanPage({ title, description, actionLabel, columns, metrics, filters }: KanbanPageProps) {
  const [query, setQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);

  const visibleColumns = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ru");
    return columns.map((column) => ({
      ...column,
      cards: column.cards.filter((card) => {
        const matchesQuery = !normalizedQuery || cardSearchText(card).includes(normalizedQuery);
        const matchesFilters = Object.entries(selectedFilters).every(([key, value]) => !value || card.filters?.[key] === value);
        return matchesQuery && matchesFilters;
      }),
    }));
  }, [columns, query, selectedFilters]);

  const hasFilters = Boolean(query.trim()) || Object.values(selectedFilters).some(Boolean);

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={<Button variant="primary" onClick={() => setDialogOpen(true)}>+ {actionLabel}</Button>}
      />

      <section className="grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:grid-cols-2 lg:px-6 xl:grid-cols-4" aria-label="Показатели">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-slate-500">{metric.label}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <strong className="text-xl font-semibold text-slate-950">{metric.value}</strong>
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
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Поиск: ${title.toLocaleLowerCase("ru")}`} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>

          {filters.map((filter) => (
            <label key={filter.id} className="sr-only-within">
              <span className="sr-only">{filter.label}</span>
              <select
                value={selectedFilters[filter.id] ?? ""}
                onChange={(event) => setSelectedFilters((current) => ({ ...current, [filter.id]: event.target.value }))}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400"
              >
                <option value="">{filter.label}: все</option>
                {filter.options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          ))}

          {hasFilters ? (
            <Button onClick={() => { setQuery(""); setSelectedFilters({}); }}><FilterX size={16} />Сбросить</Button>
          ) : null}
        </div>
      </div>

      <div className="p-4 lg:p-6"><KanbanBoard columns={visibleColumns} /></div>
      <DemoActionDialog open={dialogOpen} title={actionLabel} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
