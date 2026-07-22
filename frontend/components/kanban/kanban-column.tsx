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

/** PT-03 column chrome (`DS-PT-03`). */
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
    <section
      data-pt03-column
      className={[
        "flex w-[min(310px,85vw)] shrink-0 snap-start flex-col rounded-portal-lg border transition-colors",
        isOver
          ? "border-portal-primary bg-portal-primary-soft/70"
          : "border-portal-border bg-portal-surface-secondary",
      ].join(" ")}
    >
      <header className="border-b border-portal-border px-portal-4 py-portal-3">
        <div className="flex min-w-0 items-center gap-portal-2">
          <span className={`size-2.5 shrink-0 rounded-portal-full ${column.accentClass}`} />
          <h2 className="min-w-0 flex-1 truncate text-portal-body font-semibold text-portal-text">
            {column.title}
          </h2>
          <span className="rounded-portal-full bg-portal-surface px-portal-2 py-0.5 text-portal-caption font-medium text-portal-muted shadow-portal-sm">
            {column.cards.length}
          </span>
        </div>
        {metric ? (
          <p className="mt-1 pl-[18px] text-portal-caption text-portal-muted">{metric}</p>
        ) : null}
      </header>

      <div ref={setNodeRef} className="min-h-40 space-y-portal-3 p-portal-3">
        <SortableContext
          items={column.cards.map((card) => card.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.length ? (
            column.cards.map((card) => (
              <KanbanCard key={card.id} card={card} onSelect={onCardSelect} />
            ))
          ) : (
            <EmptyState
              title="Нет записей"
              description="В этой колонке пока нет записей"
              size="compact"
              className="min-h-32"
            />
          )}
        </SortableContext>
      </div>
    </section>
  );
}
