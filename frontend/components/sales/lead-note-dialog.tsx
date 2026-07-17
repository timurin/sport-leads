"use client";

import { AtSign, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { getMentionedUserIds, insertMention } from "@/lib/sales/lead-activity";
import type { LeadActivity, UserSummary } from "@/types/sales";

function useEscape(onClose: () => void) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
}

export function LeadMentionPicker({
  text,
  selectedIds,
  managers,
  onChange,
}: {
  text: string;
  selectedIds: string[];
  managers: UserSummary[];
  onChange: (text: string, selectedIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  function mention(manager: UserSummary) {
    onChange(
      insertMention(text, manager),
      selectedIds.includes(manager.id) ? selectedIds : [...selectedIds, manager.id],
    );
    setOpen(false);
  }

  return (
    <div className="relative">
      <Button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="h-9 px-3"
      >
        <AtSign size={15} /> Упомянуть сотрудника
      </Button>
      {open ? (
        <div className="absolute left-0 z-30 mt-2 w-64 max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-xl" role="menu">
          {managers.map((manager) => (
            <button
              key={manager.id}
              type="button"
              role="menuitem"
              onClick={() => mention(manager)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold">{manager.initials}</span>
              <span className="min-w-0 break-words">{manager.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function LeadNoteEditDialog({
  note,
  managers,
  onClose,
  onSave,
}: {
  note: LeadActivity;
  managers: UserSummary[];
  onClose: () => void;
  onSave: (text: string, mentionedUserIds: string[]) => void;
}) {
  const [text, setText] = useState(note.description ?? "");
  const [selectedIds, setSelectedIds] = useState(note.mentionedUserIds ?? []);
  const [error, setError] = useState("");
  useEscape(onClose);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Введите текст заметки.");
      return;
    }
    onSave(trimmed, getMentionedUserIds(trimmed, managers));
  }

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={onClose}>
      <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-2xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="edit-lead-note-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="edit-lead-note-title" className="text-lg font-semibold text-slate-950">Редактировать внутреннюю заметку</h2>
            <p className="mt-1 text-sm text-slate-500">Изменения сохраняются только в текущей карточке.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть редактирование заметки" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="mt-5">
          <label htmlFor="edit-lead-note" className="text-sm font-medium text-slate-700">Текст заметки</label>
          <textarea id="edit-lead-note" autoFocus rows={6} maxLength={3000} value={text} onChange={(event) => { setText(event.target.value); setError(""); }} aria-invalid={Boolean(error)} aria-describedby={error ? "edit-lead-note-error" : "edit-lead-note-count"} className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              {error ? <p id="edit-lead-note-error" className="text-sm text-red-700" role="alert">{error}</p> : null}
              <p id="edit-lead-note-count" className="text-xs text-slate-500">{text.length} / 3000</p>
            </div>
            <LeadMentionPicker text={text} selectedIds={selectedIds} managers={managers} onChange={(nextText, nextIds) => { setText(nextText); setSelectedIds(nextIds); }} />
          </div>
          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" onClick={onClose}>Отмена</Button>
            <Button type="submit" variant="primary">Сохранить</Button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function LeadNoteDeleteDialog({ note, onClose, onConfirm }: {
  note: LeadActivity;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={onClose}>
      <section className="w-full max-w-md rounded-2xl bg-white p-6 text-slate-900 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="delete-lead-note-title" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="delete-lead-note-title" className="text-lg font-semibold text-slate-950">Удалить внутреннюю заметку?</h2>
        <p className="mt-2 break-words text-sm leading-6 text-slate-600">Заметка «{note.description}» исчезнет из истории и блока закреплённых заметок.</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" onClick={onClose}>Отмена</Button>
          <Button type="button" variant="primary" onClick={onConfirm} autoFocus>Удалить</Button>
        </div>
      </section>
    </div>
  );
}
