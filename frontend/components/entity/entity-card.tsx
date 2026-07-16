import {
  CalendarDays,
  CircleUserRound,
  MoreHorizontal,
} from "lucide-react";

import type {
  EntityRecord,
} from "@/types/entity/entity";

type EntityCardProps = {
  record: EntityRecord;
  selected?: boolean;
};

export function EntityCard({
  record,
  selected = false,
}: EntityCardProps) {
  return (
    <article
      className={[
        "rounded-xl border bg-white p-4 shadow-sm transition",
        selected
          ? "border-blue-400 ring-2 ring-blue-100"
          : "border-slate-200 hover:border-blue-300 hover:shadow-md",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {record.status ? (
            <div
              className={[
                "mb-2 inline-flex rounded-full px-2 py-1 text-[11px] font-medium",
                record.status.colorClass,
              ].join(" ")}
            >
              {record.status.title}
            </div>
          ) : null}

          <h3 className="truncate text-sm font-semibold text-slate-900">
            {record.title}
          </h3>

          {record.subtitle ? (
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">
              {record.subtitle}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          className="shrink-0 text-slate-400 hover:text-slate-700"
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
        {record.responsible ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CircleUserRound size={15} />
            {record.responsible}
          </div>
        ) : null}

        {record.updatedAt ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CalendarDays size={15} />
            {record.updatedAt}
          </div>
        ) : null}
      </div>
    </article>
  );
}