"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { calendarRequest, type CalendarBoard } from "@/lib/production/calendar";
import { CAPACITY_UNIT_LABEL } from "@/lib/production/calendar-capacity";
import { loadQueueLoads, queueLoadCellKey, queueLoadLabel, type QueueLoads, type QueueLoadState } from "@/lib/production/calendar-queue-load";
const reasons: Record<string, string> = {
  norm_missing: "Норма пошива отсутствует", norm_unverified: "Норма пошива не подтверждена",
  estimate_missing: "Нет оценки часов, метража или метода работы", capacity_unknown: "Доступная мощность неизвестна",
  zero_capacity: "На эту дату нет доступной мощности", milestone: "Этап готовности, без часового расчёта",
};
type LoadContext = { data: QueueLoads | null; error: string; pending: boolean };
const Context = createContext<LoadContext>({ data: null, error: "", pending: true });

export function QueueLoadProvider({ board, days, stageIds, children }: {
  board: CalendarBoard; days: string[]; stageIds: number[]; children: ReactNode;
}) {
  const [attempt, setAttempt] = useState(0);
  return <QueueLoadBatch key={attempt} board={board} days={days} stageIds={stageIds} onRetry={() => setAttempt((value) => value + 1)}>{children}</QueueLoadBatch>;
}

function QueueLoadBatch({ board, days, stageIds, children, onRetry }: {
  board: CalendarBoard; days: string[]; stageIds: number[]; children: ReactNode; onRetry: () => void;
}) {
  const [result, setResult] = useState<LoadContext>({ data: null, error: "", pending: true });
  const datesKey = days.join(",");
  const stagesKey = stageIds.join(",");
  useEffect(() => {
    const controller = new AbortController();
    loadQueueLoads(board, datesKey.split(","), stagesKey.split(",").filter(Boolean).map(Number), calendarRequest, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setResult({ data, error: "", pending: false }); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setResult({ data: null, error: error instanceof Error ? error.message : "Не удалось загрузить индикаторы", pending: false }); });
    return () => controller.abort();
  }, [board, datesKey, stagesKey]);
  return (
    <Context.Provider value={result}>
      {result.error ? <button type="button" className="text-xs text-[#667085] underline" onClick={onRetry}>Повторить индикаторы</button> : null}
      {children}
    </Context.Provider>
  );
}

const dotClass: Record<QueueLoadState, string> = {
  reserve: "bg-[#8fbfa8]", near: "bg-[#e2c48a]", over: "bg-[#e7b4ae]", unknown: "bg-[#c5cad3]",
};

/** Compact load mark. The wording stays in the tooltip and popover, not in the cell. */
export function QueueCellLoad({ stageId, date }: { stageId: number; date: string }) {
  const { data, error, pending } = useContext(Context);
  const entries = data?.cells[queueLoadCellKey(stageId, date)] ?? [];
  if (pending) return <span className="absolute right-1 top-1 size-2 rounded-full bg-[#e4e7ec]" aria-hidden="true" />;
  const label = error
    ? error
    : entries.length === 1
      ? (entries[0].load ? queueLoadLabel(entries[0].load) : "Нет расчёта")
      : entries.map((entry) => `${entry.resource.name}: ${entry.load ? queueLoadLabel(entry.load) : "Нет расчёта"}`).join("; ")
        || "Нет ресурса участка";
  const state = entries.length === 1 ? entries[0].load?.state ?? "unknown" : "unknown";
  return (
    <details className="absolute right-1 top-1 z-20" data-queue-load-cell={queueLoadCellKey(stageId, date)}>
      <summary data-queue-load={state} aria-label={label} title={label} className={`size-2 cursor-pointer list-none rounded-full ${dotClass[state]}`} />
      <div className="absolute right-0 z-30 mt-1 w-56 space-y-2 rounded-lg border border-[#dfe5ef] bg-white p-2 text-[11px] text-[#344054] shadow-md">
        {entries.map(({ resource, load, error: entryError }) => <div key={resource.key} data-queue-load={load?.state ?? "unknown"}>
          <p className="font-semibold">{resource.name}</p>
          {load ? <>
            <p>{queueLoadLabel(load)}</p>
            {load.unit !== "milestone" && <p>{load.known_planned_hours} / {load.capacity ?? "неизвестно"} {CAPACITY_UNIT_LABEL[load.unit]}</p>}
            {load.reason && <p>{reasons[load.reason] ?? load.reason}</p>}
          </> : <p>{entryError}</p>}
        </div>)}
        {!entries.length ? <p>{label}</p> : null}
      </div>
    </details>
  );
}
