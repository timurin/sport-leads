export type TechCardDeleteGuardCard = {
  salesOrderItemId: number;
  number: string;
  status: string;
  statusLabel: string;
};

const STATUS_LABEL: Record<string, string> = {
  missing: "Нет ТК",
  draft: "Черновик",
  in_progress: "В работе",
  completed: "Завершена",
  cancelled: "Отменена",
};

export function blockingTechCardsForItemIds(
  itemIds: number[],
  rows: Pick<TechCardDeleteGuardCard, "salesOrderItemId" | "number" | "status" | "statusLabel">[],
): TechCardDeleteGuardCard[] {
  const wanted = new Set(itemIds);
  return rows
    .filter((row) => wanted.has(row.salesOrderItemId) && row.status !== "missing")
    .map((row) => ({
      salesOrderItemId: row.salesOrderItemId,
      number: row.number === "—" ? `#${row.salesOrderItemId}` : row.number,
      status: row.status,
      statusLabel: row.statusLabel || STATUS_LABEL[row.status] || row.status,
    }));
}

export function formatDeleteBlockedByTechCardsMessage(cards: TechCardDeleteGuardCard[]): string {
  if (cards.length === 0) return "";
  const lines = cards.map((card) => `• ${card.number} — ${card.statusLabel}`);
  return [
    "Нельзя удалить выбранные позиции: есть созданные или запущенные техкарты.",
    ...lines,
    "Каскадное удаление техкарт не выполняется. Позиции не удалены.",
  ].join("\n");
}
