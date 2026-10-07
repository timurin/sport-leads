"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { PageContent } from "@/components/layout/page-layout";
import { CalendarToolbar } from "@/components/production/calendar-toolbar";
import { Button } from "@/components/ui/button";
import {
  calendarAssignmentInput, calendarBoardPath, calendarPlanningPath, calendarRequest,
  calendarWeekPath, shiftWeek, weekDays,
  type CalendarAssignment, type CalendarBoard, type CalendarInput, type CalendarStage,
} from "@/lib/production/calendar";

const inputClass = "w-full min-w-0 rounded-portal-md border border-portal-border bg-portal-surface px-portal-3 py-portal-2 text-portal-body";
const panelClass = "min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4";
const dateLabel = (date: string) => new Date(date + "T12:00:00").toLocaleDateString("ru-RU");

/** UI-E / PT-02: existing assignments + one compact edit panel, no capacity calculations. */
export function CalendarManualScheduling({ date, assignmentId, invalidAssignment = false }: {
  date: string;
  assignmentId: number | null;
  invalidAssignment?: boolean;
}) {
  const [revision, setRevision] = useState(0);
  const days = weekDays(date);
  return (
    <PageContent>
      <div className="space-y-portal-4">
        <CalendarToolbar current="/production/calendar/planning" />
        <header className="flex flex-wrap items-center justify-between gap-portal-3">
          <div>
            <h1 className="text-portal-title font-semibold">Ручное планирование</h1>
            <p className="text-portal-caption text-portal-muted">Перенос существующего назначения по участкам и датам</p>
          </div>
          <Link href={calendarWeekPath(date)} className="text-portal-body font-medium text-portal-primary underline">Вернуться в очередь</Link>
        </header>
        <div className="flex flex-wrap items-center gap-portal-3">
          <Link href={calendarPlanningPath(shiftWeek(date, -1))} aria-label="Предыдущая неделя" className="rounded-portal-md border border-portal-border px-portal-3 py-portal-2">←</Link>
          <span className="text-portal-body font-semibold">{dateLabel(days[0])} — {dateLabel(days[6])}</span>
          <Link href={calendarPlanningPath(shiftWeek(date, 1))} aria-label="Следующая неделя" className="rounded-portal-md border border-portal-border px-portal-3 py-portal-2">→</Link>
        </div>
        {invalidAssignment ? (
          <p role="alert" className="text-portal-danger">Некорректный номер назначения. Откройте назначение из очереди.</p>
        ) : (
          <PlanningWeek key={revision} date={date} assignmentId={assignmentId} onRetry={() => setRevision((value) => value + 1)} />
        )}
      </div>
    </PageContent>
  );
}

function PlanningWeek({ date, assignmentId, onRetry }: { date: string; assignmentId: number | null; onRetry: () => void }) {
  const [result, setResult] = useState<{ board: CalendarBoard | null; error: string }>({ board: null, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    calendarRequest<CalendarBoard>(calendarBoardPath(date), { signal: controller.signal })
      .then((board) => { if (!controller.signal.aborted) setResult({ board, error: "" }); })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ board: null, error: error instanceof Error ? error.message : "Не удалось загрузить назначения" });
      });
    return () => controller.abort();
  }, [date]);

  if (result.error) return <div role="alert" className={panelClass}><p className="text-portal-danger">{result.error}</p><Button onClick={onRetry}>Повторить</Button></div>;
  if (!result.board) return <p role="status">Загрузка назначений…</p>;
  const { board } = result;
  const selected = board.assignments.find((item) => item.id === assignmentId);
  return (
    <div className="grid min-w-0 gap-portal-4 lg:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
      <aside className={panelClass} aria-label="Назначения недели">
        <h2 className="mb-portal-3 text-portal-subtitle font-semibold">Назначения недели</h2>
        {!board.assignments.length ? <p className="text-portal-body text-portal-muted">Назначений нет. Добавьте работу в недельной очереди.</p> : (
          <ul className="space-y-portal-2">
            {board.assignments.map((item) => (
              <li key={item.id}>
                <Link href={calendarPlanningPath(item.planned_date, item.id)} aria-current={item.id === assignmentId ? "page" : undefined}
                  className={`block break-words rounded-portal-md border p-portal-3 text-portal-body ${item.id === assignmentId ? "border-portal-primary bg-portal-primary-soft" : "border-portal-border hover:bg-portal-surface-secondary"}`}>
                  <span className="block font-semibold">{item.order_number} · {item.technical_card_number}</span>
                  <span className="block text-portal-caption text-portal-muted">{dateLabel(item.planned_date)} · {item.production_stage_name} · {item.quantity} шт.</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </aside>
      {selected ? <AssignmentEditor key={selected.id} assignment={selected} stages={board.stages} /> : (
        <div className={panelClass}>
          {assignmentId !== null ? <p role="alert" className="text-portal-danger">Назначение не найдено на выбранной неделе. Возможно, оно перенесено или удалено. Откройте актуальное назначение из очереди.</p>
            : <p className="text-portal-body text-portal-muted">Выберите назначение для изменения даты или участка.</p>}
        </div>
      )}
    </div>
  );
}

function AssignmentEditor({ assignment, stages }: { assignment: CalendarAssignment; stages: CalendarStage[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<CalendarInput>(() => calendarAssignmentInput(assignment));
  const [position, setPosition] = useState(String(assignment.position));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<CalendarAssignment | null>(null);
  const pending = useRef(false);
  const destination = stages.find((item) => item.id === draft.production_stage_id)?.name ?? "Выберите участок";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      const updated = await calendarRequest<CalendarAssignment>("/assignments/" + assignment.id, {
        method: "PUT", body: JSON.stringify({ ...draft, position: Number(position), note: draft.note?.trim() || null }),
      });
      setSaved(updated);
      router.push(calendarWeekPath(updated.planned_date) + "&saved=" + updated.id);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Не удалось сохранить назначение");
      setSaving(false);
      pending.current = false;
    }
  }

  return (
    <form onSubmit={submit} className={`${panelClass} space-y-portal-4`} aria-label="Редактирование назначения">
      <div className="break-words">
        <h2 className="text-portal-subtitle font-semibold">{assignment.order_number} · {assignment.technical_card_number}</h2>
        <Link href={"/production/tech-cards/" + assignment.technical_card_id} className="text-portal-caption text-portal-primary underline">Открыть ТК</Link>
        <p className="mt-portal-2 text-portal-body">{assignment.nomenclature_name ?? "Изделие"} · {assignment.quantity} шт.</p>
        <p className="text-portal-caption text-portal-muted">Количество из ТК, без изменения в календаре</p>
      </div>
      <fieldset disabled={saving} className="min-w-0 space-y-portal-3">
        <div className="grid min-w-0 gap-portal-3 sm:grid-cols-2">
          <label className="block text-portal-body">Участок
            <select name="stage" className={inputClass} required value={draft.production_stage_id} onChange={(event) => setDraft({ ...draft, production_stage_id: Number(event.target.value) })}>
              {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
            </select>
          </label>
          <label className="block text-portal-body">Новая дата
            <input name="date" type="date" required className={inputClass} value={draft.planned_date} onChange={(event) => setDraft({ ...draft, planned_date: event.target.value })} />
          </label>
        </div>
        <label className="block text-portal-body">Позиция в очереди
          <input name="position" type="number" required min="0" step="1" className={inputClass} value={position} onChange={(event) => setPosition(event.target.value)} />
        </label>
        <label className="block text-portal-body">Примечание
          <textarea name="note" maxLength={2000} rows={3} className={inputClass} value={draft.note ?? ""} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
        </label>
      </fieldset>
      <div className="grid min-w-0 gap-portal-3 rounded-portal-md bg-portal-surface-secondary p-portal-3 text-portal-body sm:grid-cols-2" aria-label="Предпросмотр переноса">
        <div className="break-words"><h3 className="font-semibold">Было</h3><p>{dateLabel(assignment.planned_date)} · {assignment.production_stage_name} · {assignment.quantity} шт.</p></div>
        <div className="break-words"><h3 className="font-semibold">Станет</h3><p>{draft.planned_date ? dateLabel(draft.planned_date) : "Выберите дату"} · {destination} · {assignment.quantity} шт.</p></div>
      </div>
      {error && <p role="alert" className="text-portal-body text-portal-danger">{error}</p>}
      {saved && <p role="status" className="text-portal-body text-portal-primary">Назначение сохранено. <Link href={calendarWeekPath(saved.planned_date)} className="underline">Вернуться в очередь</Link></p>}
      <div className="flex flex-wrap items-center gap-portal-3">
        <Button type="submit" variant="primary" disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Button>
        {!saving && <Link href={calendarWeekPath(assignment.planned_date)} className="text-portal-body text-portal-primary underline">Отмена</Link>}
      </div>
    </form>
  );
}
