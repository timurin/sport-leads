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
  haveSameKanbanLayout,
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
  onCardSelect?: (cardId: string) => void;
};

export function KanbanBoard<TStatus extends string>({
  columns: initialColumns,
  query,
  selectedFilters,
  onColumnsChange,
  onMove,
  onCardSelect,
}: KanbanBoardProps<TStatus>) {
  const [columns, setColumns] = useState(
    () => cloneKanbanColumns(initialColumns),
  );
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const dragStartColumns = useRef<KanbanColumnData<TStatus>[] | null>(null);
  const columnsRef = useRef(columns);
  const lastAppliedMove = useRef<KanbanMove<TStatus> | null>(null);
  const movedAcrossColumns = useRef(false);
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

  function getMoveKey(move: KanbanMove<TStatus>) {
    return `${move.cardId}\u0000${move.targetColumnId}\u0000${move.targetIndex}`;
  }

  function applyLocalMove(move: KanbanMove<TStatus>) {
    const previousMove = lastAppliedMove.current;

    if (previousMove && getMoveKey(previousMove) === getMoveKey(move)) {
      return false;
    }

    const currentColumns = columnsRef.current;
    const nextColumns = moveKanbanCard(currentColumns, move);

    if (nextColumns === currentColumns) {
      return false;
    }

    columnsRef.current = nextColumns;
    lastAppliedMove.current = move;
    setColumns((renderedColumns) => moveKanbanCard(renderedColumns, move));
    return true;
  }

  function getMove(
    currentColumns: KanbanColumnData<TStatus>[],
    activeId: string,
    overId: string,
  ): KanbanMove<TStatus> | null {
    const currentVisibleColumns = filterKanbanColumns(
      currentColumns,
      query,
      selectedFilters,
    );
    const targetColumnId = findKanbanColumnId(currentVisibleColumns, overId);

    if (!targetColumnId) {
      return null;
    }

    const targetColumn = currentVisibleColumns.find(
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
    dragStartColumns.current = cloneKanbanColumns(columnsRef.current);
    lastAppliedMove.current = null;
    movedAcrossColumns.current = false;
    setActiveCardId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over ? String(event.over.id) : null;

    if (!overId) {
      return;
    }

    const activeId = String(event.active.id);
    const currentColumns = columnsRef.current;
    const currentVisibleColumns = filterKanbanColumns(
      currentColumns,
      query,
      selectedFilters,
    );
    const sourceColumnId = findKanbanColumnId(currentColumns, activeId);
    const targetColumnId = findKanbanColumnId(currentVisibleColumns, overId);

    if (!sourceColumnId || !targetColumnId || sourceColumnId === targetColumnId) {
      return;
    }

    const move = getMove(currentColumns, activeId, overId);

    if (move && applyLocalMove(move)) {
      movedAcrossColumns.current = true;
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over ? String(event.over.id) : null;
    const activeId = String(event.active.id);
    const initialColumns = dragStartColumns.current;
    setActiveCardId(null);

    if (!overId) {
      if (initialColumns) {
        columnsRef.current = initialColumns;
        setColumns(() => initialColumns);
      }

      dragStartColumns.current = null;
      lastAppliedMove.current = null;
      movedAcrossColumns.current = false;
      return;
    }

    let completedMove = lastAppliedMove.current;

    if (!movedAcrossColumns.current && activeId !== overId) {
      const move = getMove(columnsRef.current, activeId, overId);

      if (move && applyLocalMove(move)) {
        completedMove = move;
      }
    }

    const finalColumns = columnsRef.current;

    if (initialColumns && !haveSameKanbanLayout(initialColumns, finalColumns)) {
      onColumnsChange?.(finalColumns);

      if (completedMove) {
        onMove?.(completedMove);
      }
    }

    dragStartColumns.current = null;
    lastAppliedMove.current = null;
    movedAcrossColumns.current = false;
  }

  function handleDragCancel() {
    const previousColumns = dragStartColumns.current;
    setActiveCardId(null);
    dragStartColumns.current = null;
    lastAppliedMove.current = null;
    movedAcrossColumns.current = false;

    if (previousColumns) {
      columnsRef.current = previousColumns;
      setColumns(() => previousColumns);
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
            <KanbanColumn key={column.id} column={column} onCardSelect={onCardSelect} />
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
