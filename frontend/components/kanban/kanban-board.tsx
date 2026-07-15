import { KanbanColumn } from "@/components/kanban/kanban-column";
import type { KanbanColumnData } from "@/components/kanban/kanban-types";

type KanbanBoardProps = {
  columns: KanbanColumnData[];
};

export function KanbanBoard({ columns }: KanbanBoardProps) {
  const cardsCount = columns.reduce((total, column) => total + column.cards.length, 0);

  if (!cardsCount) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <h2 className="font-semibold text-slate-800">Ничего не найдено</h2>
        <p className="mt-1 text-sm text-slate-500">Измените запрос или сбросьте выбранные фильтры.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-3" aria-label="Канбан-доска">
      <div className="flex min-w-max items-start gap-4">
        {columns.map((column) => <KanbanColumn key={column.id} column={column} />)}
      </div>
    </div>
  );
}

export type { KanbanCardData, KanbanColumnData } from "@/components/kanban/kanban-types";
