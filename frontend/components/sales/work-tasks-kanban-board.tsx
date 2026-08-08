"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import {
  createWorkTaskBoardStage,
  deleteWorkTaskBoardStage,
  moveWorkTaskToBoardStage,
  updateWorkTaskBoardStage,
} from "@/app/(workspace)/sales/tasks/work-task-actions";
import { Button, IconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import {
  groupTasksByBoardStage,
  type WorkTaskBoardStage,
  type WorkTaskListItem,
} from "@/lib/work-tasks";

type Props = {
  tasks: WorkTaskListItem[];
  stages: WorkTaskBoardStage[];
  onStagesChange: (stages: WorkTaskBoardStage[]) => void;
  onTasksChange: (tasks: WorkTaskListItem[]) => void;
  onOpenTask: (taskId: number) => void;
};

export function WorkTasksKanbanBoard({
  tasks,
  stages,
  onStagesChange,
  onTasksChange,
  onOpenTask,
}: Props) {
  const { push: pushToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const columns = useMemo(
    () => groupTasksByBoardStage(tasks, stages),
    [tasks, stages],
  );

  const moveTask = async (taskId: string, boardStageId: number | null) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await moveWorkTaskToBoardStage(Number(taskId), boardStageId);
      if (!result.ok) {
        pushToast(result.message, "danger");
        return;
      }
      const stageName =
        boardStageId == null
          ? "Без стадии"
          : (stages.find((stage) => stage.id === boardStageId)?.name ??
            result.data.boardStageLabel);
      onTasksChange(
        tasks.map((task) =>
          task.id === taskId
            ? { ...task, boardStageId, boardStageLabel: stageName }
            : task,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const addStage = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const name = `Стадия ${stages.length + 1}`;
      const result = await createWorkTaskBoardStage({ name });
      if (!result.ok) {
        pushToast(result.message, "danger");
        return;
      }
      onStagesChange(
        [...stages, result.data].sort(
          (a, b) => a.sort_order - b.sort_order || a.id - b.id,
        ),
      );
      setRenamingId(result.data.id);
      setRenameValue(result.data.name);
      pushToast("Стадия добавлена", "success");
    } finally {
      setBusy(false);
    }
  };

  const renameStage = async (stageId: number) => {
    const name = renameValue.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const result = await updateWorkTaskBoardStage(stageId, { name });
      if (!result.ok) {
        pushToast(result.message, "danger");
        return;
      }
      onStagesChange(
        stages.map((stage) => (stage.id === stageId ? result.data : stage)),
      );
      onTasksChange(
        tasks.map((task) =>
          task.boardStageId === stageId
            ? { ...task, boardStageLabel: result.data.name }
            : task,
        ),
      );
      setRenamingId(null);
      pushToast("Стадия переименована", "success");
    } finally {
      setBusy(false);
    }
  };

  const removeStage = async (stageId: number) => {
    if (busy) return;
    if (!window.confirm("Удалить стадию? Задачи перейдут в «Без стадии».")) {
      return;
    }
    setBusy(true);
    try {
      const result = await deleteWorkTaskBoardStage(stageId);
      if (!result.ok) {
        pushToast(result.message, "danger");
        return;
      }
      onStagesChange(stages.filter((stage) => stage.id !== stageId));
      onTasksChange(
        tasks.map((task) =>
          task.boardStageId === stageId
            ? { ...task, boardStageId: null, boardStageLabel: "Без стадии" }
            : task,
        ),
      );
      pushToast("Стадия удалена", "success");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-portal-3 overflow-x-auto pb-2">
      {columns.map(({ stage, tasks: columnTasks }) => {
        const stageId = stage?.id ?? null;
        const title = stage?.name ?? "Без стадии";
        return (
          <section
            key={stageId == null ? "none" : `stage-${stageId}`}
            className="flex w-72 shrink-0 flex-col rounded-portal-lg border border-portal-border bg-portal-surface-secondary/60"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const taskId =
                event.dataTransfer.getData("text/task-id") || dragTaskId;
              if (taskId) void moveTask(taskId, stageId);
              setDragTaskId(null);
            }}
          >
            <header className="flex items-start justify-between gap-2 border-b border-portal-border px-portal-3 py-portal-2">
              <div className="min-w-0 flex-1">
                {renamingId === stageId && stage ? (
                  <Input
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void renameStage(stage.id);
                      if (event.key === "Escape") setRenamingId(null);
                    }}
                    size="compact"
                    disabled={busy}
                    autoFocus
                  />
                ) : (
                  <h3 className="truncate text-sm font-semibold text-portal-text">
                    {title}
                    <span className="ml-1 font-normal text-portal-muted">
                      ({columnTasks.length})
                    </span>
                  </h3>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                {stage ? (
                  <>
                    {renamingId === stage.id ? (
                      <Button
                        type="button"
                        size="compact"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void renameStage(stage.id)}
                      >
                        OK
                      </Button>
                    ) : (
                      <IconButton
                        type="button"
                        variant="ghost"
                        label="Переименовать"
                        disabled={busy}
                        onClick={() => {
                          setRenamingId(stage.id);
                          setRenameValue(stage.name);
                        }}
                      >
                        <Pencil size={14} />
                      </IconButton>
                    )}
                    <IconButton
                      type="button"
                      variant="ghost"
                      label="Удалить стадию"
                      disabled={busy}
                      onClick={() => void removeStage(stage.id)}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </>
                ) : null}
                <IconButton
                  type="button"
                  variant="ghost"
                  label="Добавить стадию"
                  disabled={busy}
                  onClick={() => void addStage()}
                >
                  <Plus size={14} />
                </IconButton>
              </div>
            </header>
            <ul className="flex min-h-[12rem] flex-col gap-2 p-portal-2">
              {columnTasks.map((task) => (
                <li key={task.id}>
                  <article
                    draggable={!busy}
                    onDragStart={(event) => {
                      setDragTaskId(task.id);
                      event.dataTransfer.setData("text/task-id", task.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDragTaskId(null)}
                    className={`cursor-grab rounded-portal-md border bg-portal-surface p-portal-3 shadow-sm active:cursor-grabbing ${
                      task.dueSoon
                        ? "border-portal-warning bg-portal-warning-soft/40"
                        : "border-portal-border"
                    }`}
                  >
                    <button
                      type="button"
                      className="text-left font-medium text-portal-text underline-offset-2 hover:underline"
                      onClick={() => onOpenTask(Number(task.id))}
                    >
                      {task.title}
                    </button>
                    <p className="mt-1 text-xs text-portal-muted">
                      {task.statusLabel}
                      <span aria-hidden> · </span>
                      {task.executorLabel}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-portal-muted">
                      {task.objectLabel}
                      {task.dueLabel !== "—" ? (
                        <>
                          <span aria-hidden> · </span>
                          <span
                            className={
                              task.overdue || task.dueSoon
                                ? "font-medium text-portal-danger"
                                : undefined
                            }
                          >
                            {task.dueLabel}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
