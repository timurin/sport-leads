import { KanbanCard } from "@/components/kanban/kanban-card";
import type { KanbanColumnData } from "@/components/kanban/kanban-types";

type KanbanColumnProps = {
  column: KanbanColumnData;
};

export function KanbanColumn({ column }: KanbanColumnProps) {
  return (
    <section className="flex w-[310px] shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50/80">
      <header className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${column.accentClass}`} />
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{column.title}</h2>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 shadow-sm">{column.cards.length}</span>
        </div>
        {column.metric ? <p className="mt-1 pl-[18px] text-xs text-slate-500">{column.metric}</p> : null}
      </header>

      <div className="min-h-40 space-y-3 p-3">
        {column.cards.length ? column.cards.map((card) => <KanbanCard key={card.id} card={card} />) : (
          <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/60 px-5 text-center text-xs leading-5 text-slate-400">
            В этой колонке пока нет записей
          </div>
        )}
      </div>
    </section>
  );
}
