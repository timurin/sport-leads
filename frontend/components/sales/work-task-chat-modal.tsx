"use client";

import { useEffect, useState } from "react";

import {
  getWorkTask,
  listWorkTaskMessages,
} from "@/app/(workspace)/sales/tasks/work-task-actions";
import { WorkTaskChatPanel } from "@/components/sales/work-task-chat-panel";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { EmptyState } from "@/components/ui/empty-state";
import type { WorkTaskListItem, WorkTaskMessageView } from "@/lib/work-tasks";

type Props = {
  open: boolean;
  taskId: number | null;
  viewerUserId?: number | null;
  seedTask?: WorkTaskListItem | null;
  onClose: () => void;
};

export function WorkTaskChatModal({
  open,
  taskId,
  viewerUserId = null,
  seedTask = null,
  onClose,
}: Props) {
  const [task, setTask] = useState<WorkTaskListItem | null>(seedTask);
  const [messages, setMessages] = useState<WorkTaskMessageView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || taskId == null) {
      setTask(seedTask);
      setMessages([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    if (seedTask && seedTask.id === String(taskId)) {
      setTask(seedTask);
    }
    void (async () => {
      const [taskResult, messagesResult] = await Promise.all([
        getWorkTask(taskId),
        listWorkTaskMessages(taskId),
      ]);
      if (cancelled) return;
      if (!taskResult.ok) {
        setError(taskResult.message);
        setLoading(false);
        return;
      }
      setTask(taskResult.data);
      if (messagesResult.ok) {
        setMessages(messagesResult.data);
      } else {
        setMessages([]);
        setError(messagesResult.message);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, taskId, seedTask]);

  return (
    <CreateDrawer
      open={open && taskId != null}
      title={task?.title ?? "Задача"}
      description="Быстрый чат по задаче"
      onClose={onClose}
      variant="fullscreen"
    >
      <div className="flex h-full min-h-0 flex-1 flex-col p-portal-4 sm:p-portal-6">
        {loading && !task ? (
          <EmptyState title="Загрузка…" description="Открываем чат задачи." />
        ) : error && !task ? (
          <EmptyState title="Не удалось открыть задачу" description={error} />
        ) : task ? (
          <WorkTaskChatPanel
            task={task}
            initialMessages={messages}
            messagesError={error}
            viewerUserId={viewerUserId}
            showBackLink={false}
          />
        ) : (
          <EmptyState title="Задача не найдена" description="Выберите задачу из списка." />
        )}
      </div>
    </CreateDrawer>
  );
}
