import type {
  KanbanCardData,
  KanbanColumnData,
  KanbanMove,
} from "@/components/kanban/kanban-types";

export function findKanbanColumnId<TStatus extends string>(
  columns: readonly KanbanColumnData<TStatus>[],
  itemId: string,
): TStatus | null {
  const directColumn = columns.find(
    (column) => column.id === itemId,
  );

  if (directColumn) {
    return directColumn.id;
  }

  return columns.find(
    (column) => column.cards.some((card) => card.id === itemId),
  )?.id ?? null;
}

export function findKanbanCard<TStatus extends string>(
  columns: readonly KanbanColumnData<TStatus>[],
  cardId: string,
): KanbanCardData<TStatus> | null {
  for (const column of columns) {
    const card = column.cards.find((item) => item.id === cardId);

    if (card) {
      return card;
    }
  }

  return null;
}

export function cloneKanbanColumns<TStatus extends string>(
  columns: readonly KanbanColumnData<TStatus>[],
): KanbanColumnData<TStatus>[] {
  return columns.map((column) => ({
    ...column,
    cards: column.cards.map((card) => ({ ...card })),
  }));
}

export function moveKanbanCard<TStatus extends string>(
  columns: readonly KanbanColumnData<TStatus>[],
  move: KanbanMove<TStatus>,
): KanbanColumnData<TStatus>[] {
  const sourceColumnId = findKanbanColumnId(columns, move.cardId);
  const targetColumn = columns.find(
    (column) => column.id === move.targetColumnId,
  );

  if (!sourceColumnId || !targetColumn) {
    return cloneKanbanColumns(columns);
  }

  const nextColumns = cloneKanbanColumns(columns);
  const source = nextColumns.find((column) => column.id === sourceColumnId);
  const target = nextColumns.find(
    (column) => column.id === move.targetColumnId,
  );

  if (!source || !target) {
    return nextColumns;
  }

  const sourceIndex = source.cards.findIndex(
    (card) => card.id === move.cardId,
  );

  if (sourceIndex === -1) {
    return nextColumns;
  }

  const [sourceCard] = source.cards.splice(sourceIndex, 1);
  const movedCard: KanbanCardData<TStatus> = {
    ...sourceCard,
    status: move.targetColumnId,
  };
  const visibleTargetIds = move.visibleTargetCardIds.filter(
    (cardId) => cardId !== move.cardId,
  );
  const nextVisibleCardId = visibleTargetIds[move.targetIndex];
  const previousVisibleCardId = visibleTargetIds[move.targetIndex - 1];
  let insertionIndex = target.cards.length;

  if (nextVisibleCardId) {
    const anchorIndex = target.cards.findIndex(
      (card) => card.id === nextVisibleCardId,
    );
    insertionIndex = anchorIndex === -1 ? target.cards.length : anchorIndex;
  } else if (previousVisibleCardId) {
    const anchorIndex = target.cards.findIndex(
      (card) => card.id === previousVisibleCardId,
    );
    insertionIndex = anchorIndex === -1 ? target.cards.length : anchorIndex + 1;
  }

  target.cards.splice(insertionIndex, 0, movedCard);
  return nextColumns;
}

export function filterKanbanColumns<TStatus extends string>(
  columns: readonly KanbanColumnData<TStatus>[],
  query: string,
  selectedFilters: Readonly<Record<string, string>>,
): KanbanColumnData<TStatus>[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");

  return columns.map((column) => ({
    ...column,
    cards: column.cards.filter((card) => {
      const searchText = [
        card.title,
        card.subtitle,
        card.amount,
        card.responsible,
        card.nextAction,
        ...(card.details?.flatMap((detail) => [detail.label, detail.value]) ?? []),
      ].filter(Boolean).join(" ").toLocaleLowerCase("ru");
      const matchesQuery = !normalizedQuery || searchText.includes(normalizedQuery);
      const matchesFilters = Object.entries(selectedFilters).every(
        ([key, value]) => !value || card.filters?.[key] === value,
      );

      return matchesQuery && matchesFilters;
    }),
  }));
}
