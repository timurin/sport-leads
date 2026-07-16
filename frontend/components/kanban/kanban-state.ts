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
  columns: KanbanColumnData<TStatus>[],
  move: KanbanMove<TStatus>,
): KanbanColumnData<TStatus>[] {
  const sourceColumnId = findKanbanColumnId(columns, move.cardId);
  const sourceColumn = columns.find(
    (column) => column.id === sourceColumnId,
  );
  const targetColumn = columns.find(
    (column) => column.id === move.targetColumnId,
  );

  if (!sourceColumnId || !sourceColumn || !targetColumn) {
    return columns;
  }

  const sourceIndex = sourceColumn.cards.findIndex(
    (card) => card.id === move.cardId,
  );

  if (sourceIndex === -1) {
    return columns;
  }

  const sourceCard = sourceColumn.cards[sourceIndex];
  const sameColumn = sourceColumnId === move.targetColumnId;
  const currentVisibleIndex = move.visibleTargetCardIds.indexOf(move.cardId);

  if (sameColumn && currentVisibleIndex === move.targetIndex) {
    return columns;
  }

  const sourceCards = sourceColumn.cards.filter(
    (card) => card.id !== move.cardId,
  );
  const targetCards = sameColumn ? sourceCards : targetColumn.cards;
  const movedCard: KanbanCardData<TStatus> = {
    ...sourceCard,
    status: move.targetColumnId,
  };
  const visibleTargetIds = move.visibleTargetCardIds.filter(
    (cardId) => cardId !== move.cardId,
  );
  const targetIndex = Math.max(
    0,
    Math.min(move.targetIndex, visibleTargetIds.length),
  );
  const nextVisibleCardId = visibleTargetIds[targetIndex];
  const previousVisibleCardId = visibleTargetIds[targetIndex - 1];
  let insertionIndex = targetCards.length;

  if (nextVisibleCardId) {
    const anchorIndex = targetCards.findIndex(
      (card) => card.id === nextVisibleCardId,
    );
    insertionIndex = anchorIndex === -1 ? targetCards.length : anchorIndex;
  } else if (previousVisibleCardId) {
    const anchorIndex = targetCards.findIndex(
      (card) => card.id === previousVisibleCardId,
    );
    insertionIndex = anchorIndex === -1 ? targetCards.length : anchorIndex + 1;
  }

  const nextTargetCards = [...targetCards];
  nextTargetCards.splice(insertionIndex, 0, movedCard);

  if (
    sameColumn
    && nextTargetCards.every(
      (card, index) => (
        card.id === sourceColumn.cards[index]?.id
        && card.status === sourceColumn.cards[index]?.status
      ),
    )
  ) {
    return columns;
  }

  return columns.map((column) => {
    if (column.id === move.targetColumnId) {
      return { ...column, cards: nextTargetCards };
    }

    if (!sameColumn && column.id === sourceColumnId) {
      return { ...column, cards: sourceCards };
    }

    return column;
  });
}

export function haveSameKanbanLayout<TStatus extends string>(
  first: readonly KanbanColumnData<TStatus>[],
  second: readonly KanbanColumnData<TStatus>[],
): boolean {
  return first.length === second.length && first.every((column, columnIndex) => {
    const otherColumn = second[columnIndex];

    return column.id === otherColumn?.id
      && column.cards.length === otherColumn.cards.length
      && column.cards.every((card, cardIndex) => (
        card.id === otherColumn.cards[cardIndex]?.id
        && card.status === otherColumn.cards[cardIndex]?.status
      ));
  });
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
