"use client";

import { useEffect, useRef, useState } from "react";
import {
  calendarStatusFilterSummary,
  toggleCalendarStatus,
  type CalendarStatusOption,
} from "@/lib/production/calendar-status-filter";

const controlClass = "flex w-full min-w-0 items-center justify-between gap-2 rounded-portal-md border border-portal-border bg-portal-surface px-portal-3 py-portal-2 text-left text-portal-body sm:w-56";

export function CalendarStatusFilter({
  options,
  selected,
  onChange,
}: {
  options: CalendarStatusOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const summary = calendarStatusFilterSummary(selected, options);
  const optionValues = options.map((item) => item.value);

  useEffect(() => {
    if (!open) return;
    function close(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div ref={root} className="relative grid min-w-0 w-full gap-1 sm:w-auto" data-calendar-status-filter>
      <span className="text-[11px] font-bold text-[#667085]" id="calendar-status-filter-label">Статус</span>
      <button
        type="button"
        className={controlClass}
        aria-labelledby="calendar-status-filter-label"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{summary}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div role="listbox" aria-multiselectable="true" aria-labelledby="calendar-status-filter-label" className="absolute left-0 top-full z-30 mt-1 w-full min-w-52 rounded-lg border border-[#dfe5ef] bg-white p-1 shadow-md sm:w-56">
          <label className="flex items-center gap-2 rounded px-2 py-1.5 text-xs">
            <input
              type="checkbox"
              checked={selected.length === 0}
              onChange={() => onChange([])}
            />
            Все
          </label>
          {options.map((option) => (
            <label key={option.value} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs">
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => onChange(toggleCalendarStatus(selected, option.value, optionValues))}
              />
              {option.label}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
