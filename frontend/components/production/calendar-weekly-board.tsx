"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { CalendarToolbar } from "@/components/production/calendar-toolbar";
import { QueueCellLoad, QueueLoadProvider } from "@/components/production/calendar-queue-load";
import {
  acceptCreatedAssignment, assignmentRange, calendarCreateInput, calendarErrorMessage, calendarRequest, calendarSourceLabel, enqueueAssignment, localDate, shiftWeek, sourceSearchState, stageStickerTone, stickerLabel, weekDays, weekStickers,
  type CalendarAssignment, type CalendarBoard, type CalendarSource, type CalendarStage,
} from "@/lib/production/calendar";
import { fetchTechnicalCard, type ApiTechnicalCard } from "@/lib/sales/order-tech-cards-api";

const inputClass = "w-full min-w-0 rounded-portal-md border border-portal-border bg-portal-surface px-portal-3 py-portal-2 text-portal-body";
const dateLabel = (date: string) => new Date(date + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short", weekday: "short" });

export function CalendarWeeklyBoard({ initialDate = null, saved = false }: { initialDate?: string | null; saved?: boolean }) {
  const [anchor, setAnchor] = useState<string | null>(initialDate);
  const [stage, setStage] = useState("");
  const [board, setBoard] = useState<CalendarBoard>({ assignments: [], stages: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<CalendarAssignment | "new" | null>(null);
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [selected, setSelected] = useState<CalendarSource | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [sourceError, setSourceError] = useState("");
  const [sourceLoading, setSourceLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<CalendarAssignment | null>(null);
  const [card, setCard] = useState<ApiTechnicalCard | null>(null);
  const [cardError, setCardError] = useState("");
  const [cardLoading, setCardLoading] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const previewDialog = useRef<HTMLDialogElement>(null);
  const days = anchor ? weekDays(anchor) : [];

  useEffect(() => { if (!initialDate) setAnchor(localDate(new Date())); }, [initialDate]);
  useEffect(() => {
    if (!anchor) return;
    const controller = new AbortController();
    const dates = weekDays(anchor);
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ from: dates[0], to: dates[6] });
    if (stage) query.set("stage_id", stage);
    calendarRequest<CalendarBoard>("/board?" + query, { signal: controller.signal })
      .then(setBoard)
      .catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [anchor, stage, revision]);

  useEffect(() => {
    if (!editing) return;
    dialog.current?.showModal();
    if (editing !== "new" || !search.trim() || (selected && search === calendarSourceLabel(selected))) return;
    const controller = new AbortController();
    setSourceLoading(true);
    setSourceError("");
    const timer = setTimeout(() => {
      calendarRequest<CalendarSource[]>("/sources?search=" + encodeURIComponent(search.trim()), { signal: controller.signal })
        .then((rows) => { if (!controller.signal.aborted) setSources(rows); })
        .catch((failure: Error) => { if (!controller.signal.aborted) setSourceError(failure.message); })
        .finally(() => { if (!controller.signal.aborted) setSourceLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [editing, search, selected]);

  useEffect(() => {
    if (!preview) return;
    const node = previewDialog.current;
    if (node && !node.open) node.showModal();
    const controller = new AbortController();
    setCard(null);
    setCardError("");
    setCardLoading(true);
    fetchTechnicalCard(preview.technical_card_id)
      .then((loaded) => { if (!controller.signal.aborted) setCard(loaded); })
      .catch((failure: unknown) => { if (!controller.signal.aborted) setCardError(failure instanceof Error ? failure.message : "Не удалось открыть техкарту"); })
      .finally(() => { if (!controller.signal.aborted) setCardLoading(false); });
    return () => controller.abort();
  }, [preview]);

  function close() {
    dialog.current?.close();
    setEditing(null);
    setFormError("");
    setSearch("");
    setSelected(null);
    setSources([]);
    setSourceError("");
    setSourceLoading(false);
  }
  function closePreview() {
    previewDialog.current?.close();
    setPreview(null);
    setCard(null);
    setCardError("");
    setCardLoading(false);
  }
  function open(item: CalendarAssignment | "new") {
    setFormError("");
    setEditing(item);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !editing) return;
    const data = new FormData(event.currentTarget);
    const note = String(data.get("note") ?? "");
    const plannedDate = String(data.get("date"));
    if (editing === "new") {
      if (selected == null) {
        setFormError("Выберите техническую карту");
        return;
      }
      const cardId = selected.id;
      setSaving(true);
      setFormError("");
      try {
        const saved = await enqueueAssignment(calendarRequest, calendarCreateInput(cardId, plannedDate, note));
        setBoard((current) => acceptCreatedAssignment(current, saved));
        setNotice("Назначение добавлено в «" + saved.production_stage_name + "»");
        setAnchor(saved.planned_date);
        setStage((current) => current && Number(current) !== saved.production_stage_id ? "" : current);
        setRevision((value) => value + 1);
        close();
      } catch (failure) {
        setNotice("");
        setFormError(calendarErrorMessage(failure, "Не удалось сохранить"));
      } finally { setSaving(false); }
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const saved = await calendarRequest<CalendarAssignment>("/assignments/" + editing.id, {
        method: "PUT",
        body: JSON.stringify({
          production_stage_id: Number(data.get("stage")),
          planned_date: plannedDate,
          position: Number(data.get("position")),
          note: note.trim() || null,
        }),
      });
      setAnchor(saved.planned_date);
      setStage((current) => current && Number(current) !== saved.production_stage_id ? "" : current);
      setRevision((value) => value + 1);
      close();
    } catch (failure) {
      setNotice("");
      setFormError(calendarErrorMessage(failure, "Не удалось сохранить"));
    }
    finally { setSaving(false); }
  }
  async function remove() {
    if (!editing || editing === "new" || saving) return;
    if (!window.confirm("Удалить назначение из очереди? ТК сохранится.")) return;
    setSaving(true);
    try {
      await calendarRequest<void>("/assignments/" + editing.id, { method: "DELETE" });
      setRevision((value) => value + 1);
      close();
    } catch (failure) { setFormError(failure instanceof Error ? failure.message : "Не удалось удалить"); }
    finally { setSaving(false); }
  }

  const visibleStages = board.stages.filter((item) => !stage || item.id === Number(stage));
  return (
    <section className="space-y-4 p-4 lg:p-6" aria-label="Производственный календарь">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.09em] text-[#1f5eff]">Производство / планирование</p>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Производственный календарь</h1>
          <p className="text-[13px] text-[#667085]">Недельная очередь. Полоска заказа показывает длительность операции.</p>
        </div>
        <Button onClick={() => open("new")} disabled={loading || !!error}>Добавить в очередь</Button>
      </header>
      <CalendarToolbar current="/production/calendar" />
      {saved && <p role="status" className="text-portal-primary">Назначение сохранено. Очередь обновлена.</p>}
      {notice ? <p role="status" className="text-portal-primary">{notice}</p> : null}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-[#dfe5ef] bg-white p-3.5 shadow-[0_4px_14px_rgb(27_46_94_/_0.05)]">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" aria-label="Предыдущая неделя" onClick={() => anchor && setAnchor(shiftWeek(anchor, -1))}>‹</Button>
          <strong className="min-w-52 text-center text-[15px]">{days.length ? dateLabel(days[0]) + " — " + dateLabel(days[6]) : "Неделя"}</strong>
          <Button variant="secondary" aria-label="Следующая неделя" onClick={() => anchor && setAnchor(shiftWeek(anchor, 1))}>›</Button>
          <Button variant="ghost" onClick={() => setAnchor(localDate(new Date()))}>Сегодня</Button>
        </div>
        <label className="grid gap-1 text-[11px] font-bold text-[#667085]" htmlFor="calendar-stage-filter">Участок
          <select id="calendar-stage-filter" className={inputClass} value={stage} onChange={(event) => setStage(event.target.value)}>
            <option value="">Все участки</option>
            {board.stages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </div>
      {loading ? <p role="status">Загрузка недели…</p> : error ? (
        <div role="alert" className="text-portal-danger">{error} <Button variant="secondary" onClick={() => setRevision((v) => v + 1)}>Повторить</Button></div>
      ) : (
        <>
          {!board.assignments.length && <p className="rounded-xl border border-[#dfe5ef] bg-[#f8fafc] px-4 py-3 text-xs text-[#667085]">На этой неделе назначений нет. Добавьте работу в очередь.</p>}
          {!visibleStages.length && <p>Участки не настроены. Откройте справочник производственных этапов.</p>}
          <QueueLoadProvider board={board} days={days} stageIds={visibleStages.map((item) => item.id)}>
            <div className="overflow-x-auto rounded-xl border border-[#dfe5ef] bg-white shadow-[0_4px_14px_rgb(27_46_94_/_0.05)]">
              <div className="grid min-w-[1060px]" style={{ gridTemplateColumns: "10.5rem repeat(7, minmax(0, 1fr))" }}>
                <div className="sticky left-0 z-10 border-b border-[#edf0f5] bg-[#f8fafc] px-4 py-2.5 text-left text-[11px] font-semibold text-[#475467]">Участок</div>
                {days.map((day) => <div key={day} className="border-b border-l border-[#edf0f5] bg-[#f8fafc] px-2 py-2.5 text-center text-[11px] text-[#475467]">{dateLabel(day)}</div>)}
              </div>
              {visibleStages.map((item) => (
                <StageRow key={item.id} stage={item} days={days} assignments={board.assignments} onOpen={setPreview} />
              ))}
            </div>
          </QueueLoadProvider>
        </>
      )}
      <dialog ref={dialog} onCancel={(event) => { if (saving) event.preventDefault(); else close(); }}
        className="m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-portal-lg border border-portal-border bg-portal-surface p-portal-5 text-portal-text backdrop:bg-black/30"
        aria-labelledby="calendar-dialog-title">
        {editing && <form key={editing === "new" ? "new" : editing.id} onSubmit={submit} className="space-y-portal-3">
          <h2 id="calendar-dialog-title" className="text-portal-subtitle font-semibold">{editing === "new" ? "Поставить в очередь" : "Перенести назначение"}</h2>
          {editing === "new" ? (
            <QueueEntryForm
              search={search}
              sources={sources}
              selected={selected}
              activeIndex={activeIndex}
              loading={sourceLoading}
              error={sourceError}
              date={days[0] ?? ""}
              onSearch={(value) => {
                setSearch(value);
                setActiveIndex(0);
                if (!value.trim()) {
                  setSources([]);
                  setSourceError("");
                  setSourceLoading(false);
                  setSelected(null);
                  return;
                }
                if (selected && value !== calendarSourceLabel(selected)) setSelected(null);
              }}
              onActiveIndex={setActiveIndex}
              onSelect={(item) => {
                setSelected(item);
                setSearch(calendarSourceLabel(item));
                setSources([]);
              }}
            />
          ) : (
            <>
              <p>{editing.order_number} · {editing.technical_card_number} · {editing.quantity} шт.</p>
              <label className="block">Участок<select name="stage" className={inputClass} required defaultValue={editing.production_stage_id}>
                <option value="">Выберите участок</option>
                {board.stages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select></label>
              <label className="block">Дата<input name="date" type="date" className={inputClass} required defaultValue={editing.planned_date} /></label>
              <label className="block">Позиция в очереди<input name="position" type="number" min="0" step="1" required className={inputClass} defaultValue={editing.position} /></label>
              <label className="block">Примечание<textarea name="note" maxLength={2000} className={inputClass} defaultValue={editing.note ?? ""} /></label>
            </>
          )}
          {formError && <p role="alert" className="text-portal-danger">{formError}</p>}
          <div className="flex flex-wrap gap-portal-2">
            <Button type="submit" disabled={saving || (editing === "new" && !selected)}>{saving ? "Сохранение…" : editing === "new" ? "Добавить в очередь" : "Сохранить"}</Button>
            <Button type="button" variant="secondary" disabled={saving} onClick={close}>Отмена</Button>
            {editing !== "new" && <Button type="button" variant="danger" disabled={saving} onClick={remove}>Удалить</Button>}
          </div>
        </form>}
      </dialog>
      <dialog ref={previewDialog} onClose={closePreview}
        className="m-auto w-[min(960px,calc(100%_-_2rem))] rounded-2xl border border-[#dfe5ef] bg-white p-0 text-[#101828] shadow-[0_24px_80px_rgb(15_23_42_/_0.25)] backdrop:bg-[rgb(16_24_40_/_0.45)]"
        aria-labelledby="calendar-card-title">
        {preview ? <TechCardPreview assignment={preview} card={card} loading={cardLoading} error={cardError} onClose={closePreview} onMove={() => { const item = preview; closePreview(); open(item); }} /> : null}
      </dialog>
    </section>
  );
}

function QueueEntryForm({
  search, sources, selected, activeIndex, loading, error, date, onSearch, onActiveIndex, onSelect,
}: {
  search: string;
  sources: CalendarSource[];
  selected: CalendarSource | null;
  activeIndex: number;
  loading: boolean;
  error: string;
  date: string;
  onSearch: (value: string) => void;
  onActiveIndex: (index: number) => void;
  onSelect: (item: CalendarSource) => void;
}) {
  const locked = selected != null && search === calendarSourceLabel(selected);
  const state = sourceSearchState({ query: search, loading, error, count: sources.length });
  return (
    <>
      <p className="text-portal-caption text-portal-muted">Достаточно карточки и даты. Старт и место в очереди назначит система.</p>
      <label className="block" htmlFor="calendar-source-search">Техническая карта / заказ
        <input
          id="calendar-source-search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={!locked && state === "results"}
          aria-controls="calendar-source-options"
          className={inputClass}
          placeholder="Начните вводить номер ТК или заказа"
          value={search}
          autoComplete="off"
          onChange={(event) => onSearch(event.target.value)}
          onKeyDown={(event) => {
            if (locked || state !== "results" || !sources.length) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              onActiveIndex((activeIndex + 1) % sources.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              onActiveIndex((activeIndex - 1 + sources.length) % sources.length);
            } else if (event.key === "Enter") {
              event.preventDefault();
              const pick = sources[Math.min(activeIndex, sources.length - 1)];
              if (pick) onSelect(pick);
            }
          }}
        />
      </label>
      {!locked && state === "searching" ? <p role="status">Ищем…</p> : null}
      {!locked && state === "error" ? <p role="alert" className="text-portal-danger">{error}</p> : null}
      {!locked && state === "results" ? (
        <ul id="calendar-source-options" role="listbox" className="max-h-48 space-y-portal-1 overflow-y-auto rounded-portal-md border border-portal-border p-portal-2">
          {sources.map((item, index) => (
            <li key={item.id} role="option" aria-selected={index === activeIndex}>
              <button type="button" className={`w-full rounded-portal-md px-portal-2 py-portal-2 text-left ${index === activeIndex ? "bg-portal-primary-soft" : ""}`} onClick={() => onSelect(item)}>
                {calendarSourceLabel(item)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {locked ? <p role="status">Выбрано: {calendarSourceLabel(selected)}</p> : null}
      {!locked && state === "empty" ? (
        <p>ТК не найдена. <Link href="/production/tech-cards" className="font-medium text-portal-primary underline">Создать standalone ТК</Link></p>
      ) : null}
      <label className="block">Дата постановки в очередь<input name="date" type="date" className={inputClass} required defaultValue={date} /></label>
      <label className="block">Примечание<textarea name="note" maxLength={2000} className={inputClass} placeholder="Необязательно" /></label>
    </>
  );
}

const STICKER_CLASS: Record<string, string> = {
  launch: "border-[#d5d8e6] bg-[#eef0f6] text-[#3f3d56]",
  design: "border-[#d3e2f8] bg-[#e8f1ff] text-[#1e3a5f]",
  print: "border-[#f3e2c4] bg-[#fff6e8] text-[#6b4e16]",
  cutting: "border-[#cfe6d8] bg-[#e7f4ec] text-[#1f4d38]",
  sewing: "border-[#ead8e4] bg-[#f8eef6] text-[#5c3d55]",
  packaging: "border-[#d5e0e8] bg-[#eef3f6] text-[#3d4c57]",
  quality: "border-[#d0e4d4] bg-[#e8f3ea] text-[#24523a]",
  ready: "border-[#d3ead6] bg-[#eef8ef] text-[#24613a]",
};

function StageRow({ stage, days, assignments, onOpen }: {
  stage: CalendarStage;
  days: string[];
  assignments: CalendarAssignment[];
  onOpen: (item: CalendarAssignment) => void;
}) {
  const stickers = weekStickers(assignments, stage.id, days);
  const lanes = Math.max(1, ...stickers.map((item) => item.lane + 1));
  const tone = STICKER_CLASS[stageStickerTone(stage)] ?? STICKER_CLASS.launch;
  return (
    <div className="grid min-w-[1060px] border-t border-[#edf0f5]" style={{ gridTemplateColumns: "10.5rem repeat(7, minmax(0, 1fr))" }}>
      <div className="sticky left-0 z-10 border-r border-[#edf0f5] bg-white px-4 py-2 text-[13px] font-semibold" style={{ gridRow: `1 / span ${lanes}` }}>{stage.name}</div>
      {days.map((day, index) => (
        <div key={day} className="relative min-h-11 border-l border-[#edf0f5]" style={{ gridColumn: index + 2, gridRow: `1 / span ${lanes}` }}>
          <QueueCellLoad stageId={stage.id} date={day} />
        </div>
      ))}
      {stickers.map((sticker) => {
        const range = assignmentRange(sticker.assignment);
        const label = stickerLabel(sticker.assignment);
        return (
          <button
            key={sticker.assignment.id}
            type="button"
            data-sticker={sticker.assignment.id}
            className={`z-10 mx-1 my-1 h-7 truncate rounded-md border px-2 text-left text-xs font-semibold ${tone} ${sticker.continuesBefore ? "rounded-l-none" : ""} ${sticker.continuesAfter ? "rounded-r-none" : ""}`}
            style={{ gridColumn: `${sticker.startIndex + 2} / ${sticker.endIndex + 3}`, gridRow: sticker.lane + 1 }}
            title={`${label} · ${stage.name} · ${range.start} — ${range.end}`}
            onClick={() => onOpen(sticker.assignment)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function TechCardPreview({ assignment, card, loading, error, onClose, onMove }: {
  assignment: CalendarAssignment;
  card: ApiTechnicalCard | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onMove: () => void;
}) {
  const range = assignmentRange(assignment);
  const materials = (card?.composition_lines ?? []).filter((line) => line.line_kind === "material");
  const sizes = (card?.unit_lines ?? []).map((line) => [line.size, line.size_type].filter(Boolean).join(" ")).filter(Boolean);
  const personalization = (card?.unit_lines ?? []).map((line) => line.personalization).filter((value): value is string => Boolean(value));
  const notes = [assignment.note, card?.notes].filter((value): value is string => Boolean(value && value.trim()));
  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-[#dfe5ef] px-5 py-4">
        <div>
          <h2 id="calendar-card-title" className="text-lg font-semibold">{stickerLabel(assignment)}</h2>
          <p className="text-xs text-[#667085]">{card?.client_name || "Клиент не указан"} · {card?.nomenclature_name || assignment.nomenclature_name || "Изделие"}</p>
        </div>
        <button type="button" className="rounded-lg border border-[#dfe5ef] px-2 py-1" aria-label="Закрыть" onClick={onClose}>×</button>
      </div>
      <div className="max-h-[65vh] space-y-3 overflow-auto px-5 py-4 text-sm">
        {loading ? <p role="status">Открываем техкарту…</p> : null}
        {error ? <p role="alert" className="text-portal-danger">{error}</p> : null}
        <dl className="grid gap-2 sm:grid-cols-2">
          <div><dt className="text-xs text-[#667085]">Количество</dt><dd>{String(card?.quantity ?? assignment.quantity)}</dd></div>
          <div><dt className="text-xs text-[#667085]">Текущая стадия</dt><dd>{assignment.production_stage_name}</dd></div>
          <div><dt className="text-xs text-[#667085]">Операция</dt><dd>{range.start} — {range.end}</dd></div>
          <div><dt className="text-xs text-[#667085]">Плановая готовность</dt><dd>{card?.desired_date || "Пока не задана"}</dd></div>
        </dl>
        <section><h3 className="text-xs font-bold text-[#667085]">Материалы</h3><p>{materials.length ? materials.map((line) => line.snapshot_name).join(", ") : "Нет строк материалов"}</p></section>
        <section><h3 className="text-xs font-bold text-[#667085]">Размеры</h3><p>{sizes.length ? sizes.join(", ") : "Нет размеров"}</p></section>
        <section><h3 className="text-xs font-bold text-[#667085]">Персонализация</h3><p>{personalization.length ? personalization.join(", ") : "Нет персонализации"}</p></section>
        <section><h3 className="text-xs font-bold text-[#667085]">Примечания</h3><p>{notes.length ? notes.join(" · ") : "Нет примечаний"}</p></section>
      </div>
      <div className="flex justify-end gap-2 border-t border-[#dfe5ef] px-5 py-3">
        <Button type="button" variant="secondary" onClick={onMove}>Перенести назначение</Button>
        <Link className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold text-[#1f5eff] underline" href={"/production/tech-cards/" + assignment.technical_card_id}>Открыть техкарту</Link>
        <Button type="button" onClick={onClose}>Закрыть</Button>
      </div>
    </>
  );
}

