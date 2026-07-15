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
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  CSS,
} from "@dnd-kit/utilities";
import {
  CalendarDays,
  CircleUserRound,
  GripVertical,
  MoreHorizontal,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

export type KanbanCardData = {
  id: string;
  title: string;
  subtitle?: string;
  responsible?: string;
  amount?: string;
  deadline?: string;
  tag?: string;
};

export type KanbanColumnData = {
  id: string;
  title: string;
  accentClass: string;
  cards: KanbanCardData[];
};

type KanbanBoardProps = {
  columns: KanbanColumnData[];
  onChange?: (
    columns: KanbanColumnData[],
  ) => void;
};

type SortableCardProps = {
  card: KanbanCardData;
};

function CardContent({
  card,
  dragging = false,
}: {
  card: KanbanCardData;
  dragging?: boolean;
}) {
  return (
    <article
      className={[
        "rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition",
        dragging
          ? "rotate-2 border-blue-400 shadow-2xl"
          : "hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md",
      ].join(" ")}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 text-slate-300">
          <GripVertical size={17} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              {card.tag ? (
                <div className="mb-2 inline-flex rounded-full bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">
                  {card.tag}
                </div>
              ) : null}

              <h3 className="text-sm font-semibold leading-5 text-slate-900">
                {card.title}
              </h3>
            </div>

            <button
              type="button"
              className="shrink-0 text-slate-400 hover:text-slate-700"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
            >
              <MoreHorizontal size={18} />
            </button>
          </div>

          {card.subtitle ? (
            <p className="mt-2 text-sm leading-5 text-slate-500">
              {card.subtitle}
            </p>
          ) : null}

          {card.amount ? (
            <div className="mt-4 text-base font-semibold text-slate-900">
              {card.amount}
            </div>
          ) : null}

          <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
            {card.responsible ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <CircleUserRound size={15} />
                {card.responsible}
              </div>
            ) : null}

            {card.deadline ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <CalendarDays size={15} />
                {card.deadline}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function SortableCard({
  card,
}: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
  });

  const style = {
    transform: CSS.Transform.toString(
      transform,
    ),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab touch-none active:cursor-grabbing"
    >
      <CardContent card={card} />
    </div>
  );
}

function KanbanColumn({
  column,
}: {
  column: KanbanColumnData;
}) {
  const {
    setNodeRef,
    isOver,
  } = useDroppable({
    id: column.id,
  });

  return (
    <section className="w-[310px] shrink-0">
      <header className="mb-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={[
                "h-2.5 w-2.5 rounded-full",
                column.accentClass,
              ].join(" ")}
            />

            <h2 className="text-sm font-semibold text-slate-900">
              {column.title}
            </h2>
          </div>

          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
            {column.cards.length}
          </span>
        </div>
      </header>

      <div
        ref={setNodeRef}
        className={[
          "min-h-[520px] space-y-3 rounded-xl border-2 p-3 transition-colors",
          isOver
            ? "border-blue-400 bg-blue-50/70"
            : "border-transparent bg-slate-200/60",
        ].join(" ")}
      >
        <SortableContext
          items={column.cards.map(
            (card) => card.id,
          )}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
            />
          ))}
        </SortableContext>

        <button
          type="button"
          className="w-full rounded-lg border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 hover:border-blue-400 hover:bg-white hover:text-blue-600"
        >
          + Добавить
        </button>
      </div>
    </section>
  );
}

function findColumnId(
  columns: KanbanColumnData[],
  itemId: string,
): string | null {
  const directColumn = columns.find(
    (column) => column.id === itemId,
  );

  if (directColumn) {
    return directColumn.id;
  }

  const parentColumn = columns.find(
    (column) =>
      column.cards.some(
        (card) => card.id === itemId,
      ),
  );

  return parentColumn?.id ?? null;
}

function findCard(
  columns: KanbanColumnData[],
  cardId: string,
): KanbanCardData | null {
  for (const column of columns) {
    const card = column.cards.find(
      (item) => item.id === cardId,
    );

    if (card) {
      return card;
    }
  }

  return null;
}

export function KanbanBoard({
  columns: initialColumns,
  onChange,
}: KanbanBoardProps) {
  const [columns, setColumns] =
    useState<KanbanColumnData[]>(
      initialColumns,
    );

  const [activeCardId, setActiveCardId] =
    useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter:
        sortableKeyboardCoordinates,
    }),
  );

  const activeCard = useMemo(
    () =>
      activeCardId
        ? findCard(columns, activeCardId)
        : null,
    [activeCardId, columns],
  );

  function updateColumns(
    nextColumns: KanbanColumnData[],
  ) {
    setColumns(nextColumns);
    onChange?.(nextColumns);
  }

  function handleDragStart(
    event: DragStartEvent,
  ) {
    setActiveCardId(
      String(event.active.id),
    );
  }

  function handleDragOver(
    event: DragOverEvent,
  ) {
    const activeId = String(
      event.active.id,
    );

    const overId = event.over
      ? String(event.over.id)
      : null;

    if (!overId) {
      return;
    }

    const activeColumnId = findColumnId(
      columns,
      activeId,
    );

    const overColumnId = findColumnId(
      columns,
      overId,
    );

    if (
      !activeColumnId ||
      !overColumnId ||
      activeColumnId === overColumnId
    ) {
      return;
    }

    const activeColumnIndex =
      columns.findIndex(
        (column) =>
          column.id === activeColumnId,
      );

    const overColumnIndex =
      columns.findIndex(
        (column) =>
          column.id === overColumnId,
      );

    const activeColumn =
      columns[activeColumnIndex];

    const overColumn =
      columns[overColumnIndex];

    const activeCardIndex =
      activeColumn.cards.findIndex(
        (card) => card.id === activeId,
      );

    if (activeCardIndex === -1) {
      return;
    }

    const movedCard =
      activeColumn.cards[activeCardIndex];

    const overCardIndex =
      overColumn.cards.findIndex(
        (card) => card.id === overId,
      );

    const insertIndex =
      overCardIndex >= 0
        ? overCardIndex
        : overColumn.cards.length;

    const nextColumns = columns.map(
      (column) => ({
        ...column,
        cards: [...column.cards],
      }),
    );

    nextColumns[
      activeColumnIndex
    ].cards.splice(activeCardIndex, 1);

    nextColumns[
      overColumnIndex
    ].cards.splice(
      insertIndex,
      0,
      movedCard,
    );

    updateColumns(nextColumns);
  }

  function handleDragEnd(
    event: DragEndEvent,
  ) {
    const activeId = String(
      event.active.id,
    );

    const overId = event.over
      ? String(event.over.id)
      : null;

    setActiveCardId(null);

    if (!overId || activeId === overId) {
      return;
    }

    const activeColumnId = findColumnId(
      columns,
      activeId,
    );

    const overColumnId = findColumnId(
      columns,
      overId,
    );

    if (
      !activeColumnId ||
      !overColumnId ||
      activeColumnId !== overColumnId
    ) {
      return;
    }

    const columnIndex =
      columns.findIndex(
        (column) =>
          column.id === activeColumnId,
      );

    const column = columns[columnIndex];

    const oldIndex =
      column.cards.findIndex(
        (card) => card.id === activeId,
      );

    const newIndex =
      column.cards.findIndex(
        (card) => card.id === overId,
      );

    if (
      oldIndex === -1 ||
      newIndex === -1 ||
      oldIndex === newIndex
    ) {
      return;
    }

    const nextColumns = columns.map(
      (item) => ({
        ...item,
        cards: [...item.cards],
      }),
    );

    nextColumns[columnIndex].cards =
      arrayMove(
        nextColumns[columnIndex].cards,
        oldIndex,
        newIndex,
      );

    updateColumns(nextColumns);
  }

  function handleDragCancel() {
    setActiveCardId(null);
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
      <div className="min-w-0 overflow-x-auto pb-5">
        <div className="flex min-w-max gap-4">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeCard ? (
          <div className="w-[286px] cursor-grabbing">
            <CardContent
              card={activeCard}
              dragging
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}