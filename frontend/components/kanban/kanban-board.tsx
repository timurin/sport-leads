"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useMemo, useRef, useState } from "react";

import {
  KanbanCardContent,
} from "@/components/kanban/kanban-card";
import { KanbanColumn } from "@/components/kanban/kanban-column";
import {
  cloneKanbanColumns,
  filterKanbanColumns,
  findKanbanCard,
  findKanbanColumnId,
  moveKanbanCard,
} from "@/components/kanban/kanban-state";
import type {
  KanbanColumnData,
  KanbanMove,
  KanbanMoveHandler,
} from "@/components/kanban/kanban-types";

type KanbanBoardProps<TStatus extends string> = {
  columns: KanbanColumnData<TStatus>[];
  query: string;
  selectedFilters: Readonly<Record<string, string>>;
  onColumnsChange?: (columns: KanbanColumnData<TStatus>[]) => void;
  onMove?: KanbanMoveHandler<TStatus>;
};

export function KanbanBoard<TStatus extends string>({
  columns: initialColumns,
  query,
  selectedFilters,
  onColumnsChange,
  onMove,
}: KanbanBoardProps<TStatus>) {
  const [columns, setColumns] = useState(
    () => cloneKanbanColumns(initialColumns),
  );
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const dragStartColumns = useRef<KanbanColumnData<TStatus>[] | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const visibleColumns = useMemo(
    () => filterKanbanColumns(columns, query, selectedFilters),
    [columns, query, selectedFilters],
  );
  const activeCard = activeCardId
    ? findKanbanCard(columns, activeCardId)
    : null;
  const cardsCount = visibleColumns.reduce(
    (total, column) => total + column.cards.length,
    0,
  );

  function commitMove(move: KanbanMove<TStatus>) {
    const nextColumns = moveKanbanCard(columns, move);
    setColumns(nextColumns);
    onColumnsChange?.(nextColumns);
    onMove?.(move);
  }

  function getMove(
    activeId: string,
    overId: string,
  ): KanbanMove<TStatus> | null {
    const targetColumnId = findKanbanColumnId(visibleColumns, overId);

    if (!targetColumnId) {
      return null;
    }

    const targetColumn = visibleColumns.find(
      (column) => column.id === targetColumnId,
    );

    if (!targetColumn) {
      return null;
    }

    const overCardIndex = targetColumn.cards.findIndex(
      (card) => card.id === overId,
    );

    return {
      cardId: activeId,
      targetColumnId,
      targetIndex: overCardIndex === -1
        ? targetColumn.cards.length
        : overCardIndex,
      visibleTargetCardIds: targetColumn.cards.map((card) => card.id),
    };
  }

  function handleDragStart(event: DragStartEvent) {
    dragStartColumns.current = cloneKanbanColumns(columns);
    setActiveCardId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over ? String(event.over.id) : null;

    if (!overId) {
      return;
    }

    const activeId = String(event.active.id);
    const sourceColumnId = findKanbanColumnId(columns, activeId);
    const targetColumnId = findKanbanColumnId(visibleColumns, overId);

    if (!sourceColumnId || !targetColumnId || sourceColumnId === targetColumnId) {
      return;
    }

    const move = getMove(activeId, overId);

    if (move) {
      commitMove(move);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over ? String(event.over.id) : null;
    const activeId = String(event.active.id);
    setActiveCardId(null);
    dragStartColumns.current = null;

    if (!overId || activeId === overId) {
      return;
    }

    const move = getMove(activeId, overId);

    if (move) {
      commitMove(move);
    }
  }

  function handleDragCancel() {
    const previousColumns = dragStartColumns.current;
    setActiveCardId(null);
    dragStartColumns.current = null;

    if (previousColumns) {
      setColumns(previousColumns);
      onColumnsChange?.(previousColumns);
    }
  }

  if (!cardsCount) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <h2 className="font-semibold text-slate-800">Ничего не найдено</h2>
        <p className="mt-1 text-sm text-slate-500">Измените запрос или сбросьте выбранные фильтры.</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="overflow-x-auto pb-3" aria-label="Канбан-доска">
        <div className="flex min-w-max items-start gap-4">
          {visibleColumns.map((column) => (
            <KanbanColumn key={column.id} column={column} />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeCard ? (
          <div className="w-[286px] cursor-grabbing">
            <KanbanCardContent card={activeCard} dragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export type {
  KanbanCardData,
  KanbanColumnData,
} from "@/components/kanban/kanban-types";
