import {
  CalendarDays,
  CircleUserRound,
  MoreHorizontal,
} from "lucide-react";

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
};

export function KanbanBoard({
  columns,
}: KanbanBoardProps) {
  return (
    <div className="min-w-0 overflow-x-auto pb-5">
      <div className="flex min-w-max gap-4">
        {columns.map((column) => (
          <section
            key={column.id}
            className="w-[310px] shrink-0"
          >
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

            <div className="min-h-[480px] space-y-3 rounded-xl bg-slate-200/60 p-3">
              {column.cards.map((card) => (
                <article
                  key={card.id}
                  className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                >
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
                      className="text-slate-400 hover:text-slate-700"
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
                </article>
              ))}

              <button
                type="button"
                className="w-full rounded-lg border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 hover:border-blue-400 hover:bg-white hover:text-blue-600"
              >
                + Добавить
              </button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}