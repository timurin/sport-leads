"use client";

import { useMemo, useState } from "react";

import {
  loadProductionQueueAction,
  saveQueuePrioritiesAction,
  scheduleProductionQueueAction,
} from "@/app/(workspace)/production/calendar/queue-actions";
import { CalendarToolbar } from "@/components/production/calendar-toolbar";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import type { CalendarAssignment } from "@/lib/production/calendar";
import {
  QUEUE_ACTION_LABEL,
  QUEUE_PENDING_LABEL,
  canRunQueueSchedule,
  compareQueueCards,
  priorityPatch,
  queueDeviationLines,
  queueModeCaption,
  queueResultStatus,
  queueSummaryText,
  shouldRefreshCalendar,
  type QueueCardRow,
  type QueueSchedule,
} from "@/lib/production/production-queue";
import { formatPlanDay } from "@/lib/production/tech-card-schedule";

export function ProductionQueueSection({
  assignments,
  onRefresh,
}: {
  assignments: CalendarAssignment[];
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<QueueCardRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [dirty, setDirty] = useState<Record<number, true>>({});
  const [pending, setPending] = useState<"load" | "save" | "schedule" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<QueueSchedule | null>(null);
  const dirtyCount = Object.keys(dirty).length;
  const modes = useMemo(() => {
    const grouped = new Map<number, CalendarAssignment[]>();
    for (const item of assignments) {
      const rows = grouped.get(item.technical_card_id) ?? [];
      rows.push(item);
      grouped.set(item.technical_card_id, rows);
    }
    return grouped;
  }, [assignments]);

  async function openQueue() {
    const next = !open;
    setOpen(next);
    if (!next || cards.length > 0 || pending != null) return;
    setPending("load");
    setError(null);
    const loaded = await loadProductionQueueAction();
    setPending(null);
    if (!loaded.ok) {
      setError(loaded.message);
      return;
    }
    const rows = [...loaded.cards].sort(compareQueueCards);
    setCards(rows);
    setDrafts(Object.fromEntries(rows.map((row) => [row.id, row.priority == null ? "" : String(row.priority)])));
  }

  function editPriority(id: number, value: string) {
    setDrafts((current) => ({ ...current, [id]: value }));
    setDirty((current) => ({ ...current, [id]: true }));
    setNotice("Приоритет изменён. Сохраните его. Пересчёт плана сам не запустится.");
  }

  async function savePriorities() {
    const updates = Object.keys(dirty).map((id) => ({ id: Number(id), priority: drafts[Number(id)] ?? "" }));
    for (const update of updates) {
      const parsed = priorityPatch(update.priority);
      if (!parsed.ok) {
        setError(parsed.message);
        return;
      }
    }
    setPending("save");
    setError(null);
    const saved = await saveQueuePrioritiesAction(updates);
    setPending(null);
    if (!saved.ok) {
      setError(saved.message);
      return;
    }
    setCards((current) => current.map((row) => {
      if (!dirty[row.id]) return row;
      const parsed = priorityPatch(drafts[row.id] ?? "");
      return parsed.ok ? { ...row, priority: parsed.priority } : row;
    }).sort(compareQueueCards));
    setDirty({});
    setNotice("Приоритет сохранён. Нажмите «Пересчитать производственный план».");
  }

  async function runSchedule() {
    if (!canRunQueueSchedule(dirtyCount)) {
      setNotice("Сначала сохраните приоритет. Пересчёт с несохранённым порядком не запускается.");
      return;
    }
    setPending("schedule");
    setError(null);
    const result = await scheduleProductionQueueAction();
    setPending(null);
    if (!result.ok || !result.schedule) {
      setError(result.message ?? "Очередь не пересчитана");
      return;
    }
    setSchedule(result.schedule);
    setNotice(null);
    if (shouldRefreshCalendar(result.schedule)) onRefresh();
  }

  const results = new Map((schedule?.results ?? []).map((row) => [row.technical_card_id, row]));
  const visible = schedule
    ? [...(schedule.results ?? [])].map((result) => cards.find((row) => row.id === result.technical_card_id) ?? {
      id: result.technical_card_id,
      number: result.technical_card_number,
      priority: result.priority,
      created_at: "",
    })
    : cards;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CalendarToolbar current="/production/calendar" />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="compact" aria-expanded={open} onClick={() => void openQueue()}>Очередь</Button>
          <Button
            type="button"
            size="compact"
            variant="primary"
            disabled={pending != null || !canRunQueueSchedule(dirtyCount)}
            data-queue-schedule-cta
            onClick={() => void runSchedule()}
          >
            {pending === "schedule" ? QUEUE_PENDING_LABEL : QUEUE_ACTION_LABEL}
          </Button>
        </div>
      </div>
      {notice ? <InlineAlert tone="warning" size="compact">{notice}</InlineAlert> : null}
      {error ? <InlineAlert tone="danger" size="compact">{error}</InlineAlert> : null}
      {schedule ? <p role="status" data-queue-summary>{queueSummaryText(schedule)}</p> : null}
      {open ? (
        <section className="grid gap-2 rounded-xl border border-[#dfe5ef] bg-white p-3" aria-label="Очередь технических карт">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-[#475467]">Меньшее число — выше в очереди. Пустой приоритет идёт после явных.</p>
            <Button type="button" size="compact" disabled={pending != null || dirtyCount === 0} onClick={() => void savePriorities()}>
              Сохранить приоритет
            </Button>
          </div>
          {pending === "load" ? <p role="status">Загрузка очереди…</p> : null}
          {!visible.length && pending !== "load" ? <p className="text-sm text-[#667085]">В очереди нет отдельных техкарт в работе.</p> : null}
          <ul className="grid gap-2">
            {visible.map((card) => {
              const result = results.get(card.id);
              const marks = modes.get(card.id) ?? [];
              const status = queueResultStatus({ planLocked: card.plan_locked, result });
              const mode = queueModeCaption({
                planLocked: card.plan_locked,
                preserved: result?.preserved,
                modes: marks.map((item) => item.planning_mode),
                manualLocks: marks.map((item) => item.manual_lock === true),
              });
              const reasons = status === "blocked" || status === "риск срока" || status === "locked"
                ? queueDeviationLines(result?.deviations)
                : [];
              return (
                <li key={card.id} className="grid gap-2 rounded-lg border border-[#edf0f5] px-3 py-2 text-sm md:grid-cols-[minmax(0,1.4fr)_6rem_7rem_7rem_8rem_6rem]">
                  <span>{card.display_number || card.number}{card.order_number ? ` · ${card.order_number}` : ""}</span>
                  <label className="grid text-[11px] text-[#667085]">Приоритет
                    <input
                      className="rounded border border-[#dfe5ef] px-2 py-1 text-sm text-[#101828]"
                      inputMode="numeric"
                      aria-label={`Приоритет ${card.number}`}
                      value={drafts[card.id] ?? (card.priority == null ? "" : String(card.priority))}
                      onChange={(event) => editPriority(card.id, event.target.value)}
                    />
                  </label>
                  <span>Старт {card.planning_start_date ? formatPlanDay(card.planning_start_date) : "нет"}</span>
                  <span>Отгрузка {card.shipping_date ? formatPlanDay(card.shipping_date) : "нет"}</span>
                  <span data-queue-status={status}>{status}{result?.planned_completion_date ? ` · готовность ${formatPlanDay(result.planned_completion_date)}` : ""}</span>
                  <span data-queue-mode={mode}>{mode}</span>
                  {reasons.length ? (
                    <details className="md:col-span-6">
                      <summary>Причина</summary>
                      <ul>{reasons.map((line) => <li key={line}>{line}</li>)}</ul>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
