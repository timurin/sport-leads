"use client";

import { CalendarClock, CheckCircle2, Ellipsis, RotateCcw } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  formatTaskDate,
  getNearestLeadTask,
  getTaskTimingLabel,
  leadTaskTypeLabels,
  priorityLabels,
  sortLeadTasks,
  type LeadTaskFilter,
} from "@/lib/sales/lead-task";
import type { LeadTask, Priority } from "@/types/sales";

const priorityClasses: Record<Priority, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-50 text-amber-800",
  high: "bg-orange-50 text-orange-800",
  urgent: "bg-red-50 text-red-700",
};
const filterOptions: ReadonlyArray<{ id: LeadTaskFilter; label: string }> = [
  { id: "open", label: "Открытые" },
  { id: "completed", label: "Завершённые" },
  { id: "all", label: "Все" },
];

type TaskActionProps = {
  onEdit: (task: LeadTask, trigger: HTMLElement) => void;
  onComplete: (task: LeadTask, trigger: HTMLElement) => void;
  onDelete: (task: LeadTask, trigger: HTMLElement) => void;
  onReopen: (task: LeadTask) => void;
  onReschedule: (task: LeadTask, days: number) => void;
};

function LeadTaskCard({ task, referenceAt, ...actions }: { task: LeadTask; referenceAt: string } & TaskActionProps) {
  const timing = getTaskTimingLabel(task, referenceAt);
  return (
    <article id={`lead-task-${task.id}`} tabIndex={-1} className="min-w-0 border-b border-slate-200 py-3 outline-none last:border-b-0 focus-visible:ring-2 focus-visible:ring-blue-500">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">{leadTaskTypeLabels[task.type]}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityClasses[task.priority]}`}>{priorityLabels[task.priority]}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${timing === "Просрочено" ? "bg-red-50 text-red-700" : task.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{timing}</span>
          </div>
          <h3 className="mt-2 text-sm font-semibold text-slate-950">{task.title}</h3>
        </div>
        <p className="shrink-0 text-xs font-medium text-slate-500">{task.status === "completed" ? "Завершена" : "Открыта"}</p>
      </div>
      <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-slate-500">Срок</dt><dd className="mt-0.5 font-medium text-slate-800">{formatTaskDate(task.dueAt)}</dd></div>
        <div><dt className="text-xs text-slate-500">Исполнитель</dt><dd className="mt-0.5 font-medium text-slate-800">{task.assignedTo.name}</dd></div>
      </dl>
      {task.description ? <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-slate-600">{task.description}</p> : null}
      {task.result ? <div className="mt-3 border-l-2 border-emerald-300 bg-emerald-50 px-3 py-2"><p className="text-xs font-semibold text-emerald-800">Результат</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{task.result}</p></div> : null}
      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2.5" aria-label={`Действия с задачей «${task.title}»`}>
        {task.status === "open" ? <>
          <Button type="button" variant="primary" onClick={(event) => actions.onComplete(task, event.currentTarget)} className="h-8 px-2.5 text-xs"><CheckCircle2 size={14} /> Завершить</Button>
          <Button type="button" onClick={(event) => actions.onEdit(task, event.currentTarget)} className="h-8 px-2.5 text-xs">Редактировать</Button>
        </> : <Button type="button" onClick={() => actions.onReopen(task)} className="h-8 px-2.5 text-xs"><RotateCcw size={14} /> Открыть повторно</Button>}
        <details className="relative">
          <summary className="flex h-8 cursor-pointer list-none items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden"><Ellipsis size={14} /> Ещё</summary>
          <div className="absolute right-0 z-30 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            {task.status === "open" ? <>
              <button type="button" onClick={() => actions.onReschedule(task, 1)} className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">На завтра</button>
              <button type="button" onClick={() => actions.onReschedule(task, 3)} className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Перенести на 3 дня</button>
              <button type="button" onClick={() => actions.onReschedule(task, 7)} className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Перенести на неделю</button>
              <button type="button" onClick={(event) => actions.onEdit(task, event.currentTarget)} className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Выбрать срок</button>
            </> : null}
            <button type="button" onClick={(event) => actions.onDelete(task, event.currentTarget)} className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50">Удалить</button>
          </div>
        </details>
      </div>
    </article>
  );
}

export function LeadTasks({ tasks, referenceAt, filter, onFilterChange, onAdd, embedded = false, compact = false, ...actions }: {
  tasks: LeadTask[];
  referenceAt: string;
  filter: LeadTaskFilter;
  onFilterChange: (filter: LeadTaskFilter) => void;
  onAdd: (trigger: HTMLElement) => void;
  embedded?: boolean;
  compact?: boolean;
} & TaskActionProps) {
  const visibleTasks = useMemo(() => sortLeadTasks(tasks, filter, referenceAt), [filter, referenceAt, tasks]);
  const counts = useMemo(() => ({
    open: tasks.filter((task) => task.status === "open").length,
    completed: tasks.filter((task) => task.status === "completed").length,
    all: tasks.length,
  }), [tasks]);
  const primaryTasks = compact ? visibleTasks.slice(0, 4) : visibleTasks;
  const remainingTasks = compact ? visibleTasks.slice(4) : [];

  return (
    <section className={embedded ? `min-w-0 ${compact ? "p-3" : "p-4 sm:p-5"}` : "min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 id="lead-tasks-heading" tabIndex={-1} className={`${compact ? "text-sm font-bold" : "text-base font-semibold"} text-slate-950 outline-none`}>{compact ? "E) Задачи" : "Задачи по лиду"}</h2>{!compact ? <p className="mt-1 text-sm text-slate-500">Следующие действия и локальные напоминания менеджера.</p> : null}</div>
        <Button type="button" variant="primary" onClick={(event) => onAdd(event.currentTarget)} className={compact ? "h-8 px-2.5 text-xs" : ""}>Добавить</Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Фильтр задач лида">
        {filterOptions.map((option) => <button key={option.id} type="button" role="tab" aria-selected={filter === option.id} onClick={() => onFilterChange(option.id)} className={`rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${filter === option.id ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{option.label} <span className="ml-1 text-xs">{counts[option.id]}</span></button>)}
      </div>
      <div className={compact ? "mt-3 min-w-0" : "mt-4 min-w-0"} role="tabpanel">
        {visibleTasks.length ? primaryTasks.map((task) => <LeadTaskCard key={task.id} task={task} referenceAt={referenceAt} {...actions} />) : <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center"><p className="text-sm font-medium text-slate-700">Задачи отсутствуют</p><p className="mt-1 text-sm text-slate-500">Добавьте следующее действие по лиду.</p></div>}
        {remainingTasks.length ? <details className="mt-3 border-t border-slate-200 pt-3"><summary className="cursor-pointer text-xs font-semibold text-blue-700">Показать все задачи ({visibleTasks.length})</summary><div className="mt-2">{remainingTasks.map((task) => <LeadTaskCard key={task.id} task={task} referenceAt={referenceAt} {...actions} />)}</div></details> : null}
      </div>
    </section>
  );
}

export function LeadNextTask({ tasks, referenceAt, onAdd, onOpen, onComplete, onReschedule }: {
  tasks: LeadTask[];
  referenceAt: string;
  onAdd: (trigger: HTMLElement) => void;
  onOpen: (taskId: string) => void;
  onComplete: (task: LeadTask, trigger: HTMLElement) => void;
  onReschedule: (task: LeadTask) => void;
}) {
  const task = useMemo(() => getNearestLeadTask(tasks, referenceAt), [referenceAt, tasks]);
  if (!task) {
    return <div className="pt-3"><p className="text-sm font-medium text-slate-700">Задачи отсутствуют</p><Button type="button" variant="primary" onClick={(event) => onAdd(event.currentTarget)} className="mt-3 h-9">Добавить задачу</Button></div>;
  }
  const timing = getTaskTimingLabel(task, referenceAt);
  return <div className="pt-3"><div className="flex items-start gap-2"><CalendarClock size={17} className="mt-0.5 shrink-0 text-slate-400" /><div className="min-w-0"><p className="break-words text-sm font-semibold text-slate-900">{task.title}</p><p className="mt-1 text-xs text-slate-500">{leadTaskTypeLabels[task.type]} · {task.assignedTo.name}</p><p className="mt-1 text-xs font-medium text-slate-700">{formatTaskDate(task.dueAt)}</p><p className={`mt-1 text-xs font-semibold ${timing === "Просрочено" ? "text-red-700" : "text-blue-700"}`}>{timing} · {priorityLabels[task.priority]}</p></div></div><div className="mt-3 flex flex-wrap gap-2"><Button type="button" onClick={() => onOpen(task.id)} className="h-9 flex-1 px-3">Открыть</Button><Button type="button" variant="primary" onClick={(event) => onComplete(task, event.currentTarget)} className="h-9 flex-1 px-3">Завершить</Button></div><button type="button" onClick={() => onReschedule(task)} className="mt-2 text-xs font-medium text-slate-600 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Перенести на завтра</button></div>;
}
