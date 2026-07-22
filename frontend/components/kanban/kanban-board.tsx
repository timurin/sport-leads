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
  type PointerSensorOptions,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { KanbanCardContent } from "@/components/kanban/kanban-card";
import { KanbanColumn } from "@/components/kanban/kanban-column";
import { canStartKanbanDrag } from "@/components/kanban/kanban-interaction";
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
import { EmptyState } from "@/components/ui/empty-state";
type KanbanBoardProps<TStatus extends string> = {
  columns: KanbanColumnData<TStatus>[];
  query: string;
  selectedFilters: Readonly<Record<string, string>>;
  onColumnsChange?: (columns: KanbanColumnData<TStatus>[]) => void;
  onMove?: KanbanMoveHandler<TStatus>;
  onCardSelect?: (cardId: string) => void;
};

class KanbanPointerSensor extends PointerSensor {
  static activators = [{
    eventName: "onPointerDown" as const,
    handler: (
      { nativeEvent: event }: ReactPointerEvent,
      { onActivation }: PointerSensorOptions,
    ) => {
      if (!event.isPrimary || event.button !== 0 || !canStartKanbanDrag(event.target)) {
        return false;
      }

      onActivation?.({ event });
      return true;
    },
  }];
}

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
  const dndContextId = useId();
  const dragStartColumns = useRef<KanbanColumnData<TStatus>[] | null>(null);
  const columnsRef = useRef(columns);
  const lastAppliedMove = useRef<KanbanMove<TStatus> | null>(null);
  const movedAcrossColumns = useRef(false);
  const sensors = useSensors(
    useSensor(KanbanPointerSensor, {
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
    setColumns(nextColumns);
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
      <EmptyState
        title="Ничего не найдено"
        description="Измените запрос или сбросьте выбранные фильтры."
      />
    );
  }

  return (
    <DndContext
      id={dndContextId}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        data-pt03-board
        className="min-w-0 overflow-x-auto overscroll-x-contain pb-portal-3 [-webkit-overflow-scrolling:touch]"
        aria-label="Канбан-доска"
      >
        <div className="flex min-w-max snap-x snap-mandatory items-start gap-portal-4">
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
