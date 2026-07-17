"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { createTaskDueAt, getTaskFormDateTime, leadTaskTypeLabels, priorityLabels, rescheduleTaskDueAt } from "@/lib/sales/lead-task";
import { leadTaskTypes, priorities, type LeadTask, type LeadTaskType, type Priority, type UserSummary } from "@/types/sales";

const fieldClass = "mt-1 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const quickTypes: LeadTaskType[] = ["call", "message", "send_proposal", "check_payment"];
const defaultTitles: Partial<Record<LeadTaskType, string>> = {
  call: "Позвонить клиенту",
  message: "Написать клиенту",
  send_proposal: "Отправить коммерческое предложение",
  check_payment: "Проверить оплату",
};

export type LeadTaskDraft = {
  title: string;
  type: LeadTaskType;
  assignedToId: string;
  dueAt: string;
  priority: Priority;
  description?: string;
};

function useEscape(onClose: () => void) {
  useEffect(() => {
    function handler(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
}

export function LeadTaskEditDialog({ task, referenceAt, managers, onClose, onSave }: {
  task: LeadTask | null;
  referenceAt: string;
  managers: UserSummary[];
  onClose: () => void;
  onSave: (draft: LeadTaskDraft) => void;
}) {
  const defaultDateTime = getTaskFormDateTime(task?.dueAt ?? rescheduleTaskDueAt(referenceAt, referenceAt, 1));
  const [title, setTitle] = useState(task?.title ?? "");
  const [type, setType] = useState<LeadTaskType>(task?.type ?? "call");
  const [assignedToId, setAssignedToId] = useState(task?.assignedTo.id ?? managers[0]?.id ?? "");
  const [date, setDate] = useState(defaultDateTime.date);
  const [time, setTime] = useState(task ? defaultDateTime.time : "12:00");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [description, setDescription] = useState(task?.description ?? "");
  const [errors, setErrors] = useState<{ title?: string; assignedToId?: string; dueAt?: string }>({});
  useEscape(onClose);

  function selectQuickType(nextType: LeadTaskType) {
    setType(nextType);
    if (!title.trim() || Object.values(defaultTitles).includes(title)) {
      setTitle(defaultTitles[nextType] ?? "");
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const dueAt = createTaskDueAt(date, time);
    const nextErrors = {
      title: title.trim() ? undefined : "Укажите название задачи.",
      assignedToId: assignedToId ? undefined : "Выберите исполнителя.",
      dueAt: dueAt ? undefined : "Укажите корректные дату и время.",
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean) || !dueAt) return;
    onSave({ title: title.trim(), type, assignedToId, dueAt, priority, description: description.trim() || undefined });
  }

  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={onClose}>
      <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-2xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="lead-task-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div><h2 id="lead-task-dialog-title" className="text-lg font-semibold text-slate-950">{task ? "Редактировать задачу" : "Добавить задачу"}</h2><p className="mt-1 text-sm text-slate-500">Задача сохраняется локально в карточке лида.</p></div>
          <button type="button" onClick={onClose} aria-label="Закрыть форму задачи" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="mt-5">
          <div className="flex flex-wrap gap-2" aria-label="Быстрый выбор типа задачи">
            {quickTypes.map((quickType) => <button key={quickType} type="button" onClick={() => selectQuickType(quickType)} className={`rounded-full border px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${type === quickType ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}>{leadTaskTypeLabels[quickType]}</button>)}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">Название<input autoFocus value={title} onChange={(event) => { setTitle(event.target.value); setErrors((current) => ({ ...current, title: undefined })); }} className={fieldClass} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "task-title-error" : undefined} />{errors.title ? <span id="task-title-error" className="mt-1 block text-xs text-red-700">{errors.title}</span> : null}</label>
            <label className="text-sm font-medium text-slate-700">Тип<select value={type} onChange={(event) => setType(event.target.value as LeadTaskType)} className={fieldClass}>{leadTaskTypes.map((value) => <option key={value} value={value}>{leadTaskTypeLabels[value]}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Исполнитель<select value={assignedToId} onChange={(event) => { setAssignedToId(event.target.value); setErrors((current) => ({ ...current, assignedToId: undefined })); }} className={fieldClass} aria-invalid={Boolean(errors.assignedToId)} aria-describedby={errors.assignedToId ? "task-assignee-error" : undefined}>{managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}</select>{errors.assignedToId ? <span id="task-assignee-error" className="mt-1 block text-xs text-red-700">{errors.assignedToId}</span> : null}</label>
            <label className="text-sm font-medium text-slate-700">Дата<input type="date" value={date} onChange={(event) => { setDate(event.target.value); setErrors((current) => ({ ...current, dueAt: undefined })); }} className={fieldClass} aria-invalid={Boolean(errors.dueAt)} aria-describedby={errors.dueAt ? "task-due-error" : undefined} /></label>
            <label className="text-sm font-medium text-slate-700">Время<input type="time" value={time} onChange={(event) => { setTime(event.target.value); setErrors((current) => ({ ...current, dueAt: undefined })); }} className={fieldClass} aria-invalid={Boolean(errors.dueAt)} aria-describedby={errors.dueAt ? "task-due-error" : undefined} />{errors.dueAt ? <span id="task-due-error" className="mt-1 block text-xs text-red-700">{errors.dueAt}</span> : null}</label>
            <label className="text-sm font-medium text-slate-700">Приоритет<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)} className={fieldClass}>{priorities.map((value) => <option key={value} value={value}>{priorityLabels[value]}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">Описание<textarea rows={4} maxLength={3000} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
          </div>
          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end"><Button type="button" onClick={onClose}>Отмена</Button><Button type="submit" variant="primary">{task ? "Сохранить" : "Создать"}</Button></div>
        </form>
      </section>
    </div>
  );
}

export function LeadTaskCompleteDialog({ task, onClose, onConfirm }: { task: LeadTask; onClose: () => void; onConfirm: (result?: string) => void }) {
  const [result, setResult] = useState(task.result ?? "");
  useEscape(onClose);
  return <div className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={onClose}><section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="complete-task-title" onMouseDown={(event) => event.stopPropagation()}><h2 id="complete-task-title" className="text-lg font-semibold text-slate-950">Завершить задачу</h2><p className="mt-2 break-words text-sm text-slate-600">{task.title}</p><label className="mt-5 block text-sm font-medium text-slate-700">Результат<textarea autoFocus rows={4} maxLength={3000} value={result} onChange={(event) => setResult(event.target.value)} className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" onClick={onClose}>Отмена</Button><Button type="button" variant="primary" onClick={() => onConfirm(result.trim() || undefined)}>Завершить</Button></div></section></div>;
}

export function LeadTaskDeleteDialog({ task, onClose, onConfirm }: { task: LeadTask; onClose: () => void; onConfirm: () => void }) {
  useEscape(onClose);
  return <div className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={onClose}><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="delete-task-title" onMouseDown={(event) => event.stopPropagation()}><h2 id="delete-task-title" className="text-lg font-semibold text-slate-950">Удалить задачу?</h2><p className="mt-2 break-words text-sm leading-6 text-slate-600">Задача «{task.title}» будет удалена только из текущей карточки.</p><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" onClick={onClose}>Отмена</Button><Button type="button" variant="primary" onClick={onConfirm} autoFocus>Удалить</Button></div></section></div>;
}
