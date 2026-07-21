"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { KanbanCard } from "@/components/kanban/kanban-card";
import type { KanbanColumnData } from "@/components/kanban/kanban-types";
import { EmptyState } from "@/components/ui/empty-state";

type KanbanColumnProps = {
  column: KanbanColumnData;
  onCardSelect?: (cardId: string) => void;
};

export function KanbanColumn({ column, onCardSelect }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const metricValue = column.cards.reduce(
    (total, card) => total + (card.metricValues?.amount ?? 0),
    0,
  );
  const metric = metricValue
    ? `${new Intl.NumberFormat("ru-RU").format(metricValue)} ₽`
    : column.metric;

  return (
    <section className={[
      "flex w-[310px] shrink-0 flex-col rounded-xl border transition-colors",
      isOver
        ? "border-blue-400 bg-blue-50/70"
        : "border-slate-200 bg-slate-50/80",
    ].join(" ")}>
      <header className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${column.accentClass}`} />
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{column.title}</h2>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 shadow-sm">{column.cards.length}</span>
        </div>
        {metric ? <p className="mt-1 pl-[18px] text-xs text-slate-500">{metric}</p> : null}
      </header>

      <div ref={setNodeRef} className="min-h-40 space-y-3 p-3">
        <SortableContext
          items={column.cards.map((card) => card.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.length ? column.cards.map((card) => (
            <KanbanCard key={card.id} card={card} onSelect={onCardSelect} />
          )) : (
            <EmptyState
              title="Нет записей"
              description="В этой колонке пока нет записей"
              size="compact"
              className="min-h-32 border-slate-300 bg-white/60"
            />
          )}
        </SortableContext>
      </div>
    </section>
  );
}
