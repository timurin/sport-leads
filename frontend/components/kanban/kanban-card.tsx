import { CalendarDays, CircleUserRound } from "lucide-react";

import type { KanbanCardData, KanbanBadgeTone } from "@/components/kanban/kanban-types";

const badgeClasses: Record<KanbanBadgeTone, string> = {
  blue: "bg-blue-50 text-blue-700",
  amber: "bg-amber-50 text-amber-700",
  emerald: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
  slate: "bg-slate-100 text-slate-600",
  violet: "bg-violet-50 text-violet-700",
};

type KanbanCardProps = {
  card: KanbanCardData;
};

export function KanbanCard({ card }: KanbanCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-5 text-slate-900">{card.title}</h3>
          {card.subtitle ? <p className="mt-1 text-xs leading-5 text-slate-500">{card.subtitle}</p> : null}
        </div>
        {card.badge ? (
          <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${badgeClasses[card.badge.tone]}`}>
            {card.badge.label}
          </span>
        ) : null}
      </div>

      {card.details?.length ? (
        <dl className="mt-3 space-y-1.5 text-xs">
          {card.details.map((detail) => (
            <div key={`${detail.label}-${detail.value}`} className="flex items-center justify-between gap-3">
              <dt className="text-slate-400">{detail.label}</dt>
              <dd className="truncate text-right font-medium text-slate-600">{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {card.amount ? <div className="mt-3 text-base font-semibold text-slate-950">{card.amount}</div> : null}

      {card.responsible || card.nextAction ? (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          {card.responsible ? (
            <div className="flex items-center gap-2"><CircleUserRound size={14} />{card.responsible}</div>
          ) : null}
          {card.nextAction ? (
            <div className="flex items-start gap-2"><CalendarDays size={14} className="mt-0.5 shrink-0" /><span>{card.nextAction}</span></div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
