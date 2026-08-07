"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { CompactTabs } from "@/components/ui/compact-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityPanel } from "@/components/ui/entity-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import type { WorkTaskListItem } from "@/lib/work-tasks";

type StatusFilter = "open_active" | "done" | "all";

const filterOptions: ReadonlyArray<{ id: StatusFilter; label: string }> = [
  { id: "open_active", label: "Открытые" },
  { id: "done", label: "Закрытые" },
  { id: "all", label: "Все" },
];

function matchesFilter(task: WorkTaskListItem, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "done") {
    return task.status === "done" || task.status === "cancelled";
  }
  return task.status === "open" || task.status === "in_progress";
}

type Props = {
  title?: string;
  tasks: WorkTaskListItem[];
  loadError?: string | null;
  onAdd: () => void;
  embedded?: boolean;
  compact?: boolean;
};

export function HostWorkTasksPanel({
  title = "E) Задачи",
  tasks: tasksProp,
  loadError = null,
  onAdd,
  embedded = false,
  compact = false,
}: Props) {
  const [tasks, setTasks] = useState(tasksProp);
  const [filter, setFilter] = useState<StatusFilter>("open_active");

  useEffect(() => {
    setTasks(tasksProp);
  }, [tasksProp]);

  const visible = useMemo(
    () => tasks.filter((task) => matchesFilter(task, filter)),
    [tasks, filter],
  );
  const counts = useMemo(
    () => ({
      open_active: tasks.filter((task) => matchesFilter(task, "open_active"))
        .length,
      done: tasks.filter((task) => matchesFilter(task, "done")).length,
      all: tasks.length,
    }),
    [tasks],
  );

  return (
    <EntityPanel
      embedded={embedded}
      compact={compact}
      title={
        <span id="lead-tasks-heading" tabIndex={-1} className="outline-none">
          {title}
        </span>
      }
      description={
        compact ? undefined : "Постановка в цех с чатом (WorkTask / ADR-028)."
      }
      actions={
        <Button
          type="button"
          variant="primary"
          onClick={onAdd}
          className={compact ? "h-8 px-2.5 text-xs" : ""}
        >
          Добавить
        </Button>
      }
      filter={
        <CompactTabs
          label="Фильтр задач"
          size="compact"
          value={filter}
          onChange={(id) => setFilter(id as StatusFilter)}
          items={filterOptions.map((option) => ({
            id: option.id,
            label: option.label,
            count: counts[option.id],
          }))}
        />
      }
    >
      {loadError ? (
        <EmptyState
          title="Не удалось загрузить задачи"
          description={loadError}
          size="compact"
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Задач нет"
          description="Создайте задачу в цех по этому объекту."
          size="compact"
          action={
            <Button type="button" onClick={onAdd}>
              Новая задача
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-portal-border">
          {visible.map((task) => (
            <li key={task.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={task.href}
                    className="text-sm font-semibold text-portal-text underline-offset-2 hover:underline"
                  >
                    {task.title}
                  </Link>
                  <p className="mt-1 text-xs text-portal-muted">
                    {task.workshopLabel}
                    <span aria-hidden> · </span>
                    {task.executorLabel}
                  </p>
                </div>
                <StatusBadge size="compact" tone="neutral">
                  {task.statusLabel}
                </StatusBadge>
              </div>
              <div className="mt-2">
                <Link
                  href={task.href}
                  className="text-xs font-medium text-portal-primary hover:underline"
                >
                  Открыть чат
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </EntityPanel>
  );
}
