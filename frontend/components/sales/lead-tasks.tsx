"use client";

import { CalendarClock, CheckCircle2, Ellipsis, RotateCcw } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { CompactTabs } from "@/components/ui/compact-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityPanel } from "@/components/ui/entity-panel";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
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

const priorityTones: Record<Priority, StatusBadgeTone> = {
  low: "neutral",
  medium: "warning",
  high: "warning",
  urgent: "danger",
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
            <StatusBadge size="compact" tone="neutral">{leadTaskTypeLabels[task.type]}</StatusBadge>
            <StatusBadge size="compact" tone={priorityTones[task.priority]}>{priorityLabels[task.priority]}</StatusBadge>
            <StatusBadge size="compact" tone={timing === "Просрочено" ? "danger" : task.status === "completed" ? "success" : "primary"}>{timing}</StatusBadge>
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
    <EntityPanel
      embedded={embedded}
      compact={compact}
      title={(
        <span id="lead-tasks-heading" tabIndex={-1} className="outline-none">
          {compact ? "E) Задачи" : "Задачи по лиду"}
        </span>
      )}
      description={compact ? undefined : "Следующие действия и локальные напоминания менеджера."}
      actions={(
        <Button type="button" variant="primary" onClick={(event) => onAdd(event.currentTarget)} className={compact ? "h-8 px-2.5 text-xs" : ""}>
          Добавить
        </Button>
      )}
      filter={(
        <CompactTabs
          label="Фильтр задач лида"
          size="compact"
          value={filter}
          onChange={(id) => onFilterChange(id as LeadTaskFilter)}
          items={filterOptions.map((option) => ({
            id: option.id,
            label: option.label,
            count: counts[option.id],
          }))}
        />
      )}
    >
      <div role="tabpanel">
        {visibleTasks.length ? primaryTasks.map((task) => <LeadTaskCard key={task.id} task={task} referenceAt={referenceAt} {...actions} />) : (
          <EmptyState
            title="Задачи отсутствуют"
            description="Добавьте следующее действие по лиду."
            size="compact"
          />
        )}
        {remainingTasks.length ? <details className="mt-3 border-t border-slate-200 pt-3"><summary className="cursor-pointer text-xs font-semibold text-blue-700">Показать все задачи ({visibleTasks.length})</summary><div className="mt-2">{remainingTasks.map((task) => <LeadTaskCard key={task.id} task={task} referenceAt={referenceAt} {...actions} />)}</div></details> : null}
      </div>
    </EntityPanel>
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
