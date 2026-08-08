"use client";

import Link from "next/link";
import { ImagePlus, Send, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { createWorkTaskMessage } from "@/app/(workspace)/sales/tasks/work-task-actions";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import {
  isWorkTaskMessageMine,
  validateWorkTaskComposer,
  WORK_TASK_IMAGE_MAX_BYTES,
  WORK_TASK_IMAGE_MIMES,
  type WorkTaskListItem,
  type WorkTaskMessageView,
} from "@/lib/work-tasks";

type Props = {
  task: WorkTaskListItem;
  initialMessages: WorkTaskMessageView[];
  messagesError?: string | null;
  viewerUserId?: number | null;
  showBackLink?: boolean;
};

export function WorkTaskChatPanel({
  task,
  initialMessages,
  messagesError = null,
  viewerUserId = null,
  showBackLink = true,
}: Props) {
  const { push: pushToast } = useToast();
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null,
  );
  const historyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const node = historyRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null;
    setError("");
    if (!next) {
      clearFile();
      return;
    }
    if (next.size > WORK_TASK_IMAGE_MAX_BYTES) {
      setError("Изображение не больше 10 МБ");
      clearFile();
      return;
    }
    if (!WORK_TASK_IMAGE_MIMES.has(next.type)) {
      setError("Допустимы jpeg, png, webp, gif");
      clearFile();
      return;
    }
    setFile(next);
  };

  const submit = async () => {
    if (busy) return;
    const validationError = validateWorkTaskComposer({ body: draft, file });
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await createWorkTaskMessage(Number(task.id), {
        body: draft,
        file,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessages((current) => [...current, result.data]);
      setDraft("");
      clearFile();
      pushToast("Сообщение отправлено", "success");
    } catch {
      setError("Не удалось связаться с API.");
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <div
      className="flex min-h-[28rem] min-w-0 flex-1 flex-col overflow-hidden rounded-portal-lg border border-portal-border bg-portal-surface shadow-portal-card"
      data-work-task-chat
    >
      {lightbox ? (
        <ImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      ) : null}
      <header className="shrink-0 border-b border-portal-border px-portal-4 py-portal-3">
        <div className="flex flex-wrap items-start justify-between gap-portal-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold text-portal-text">
                {task.title}
              </h2>
              <StatusBadge size="compact" tone="neutral">
                {task.statusLabel}
              </StatusBadge>
              {task.overdue ? (
                <StatusBadge size="compact" tone="danger">
                  Просрочено
                </StatusBadge>
              ) : task.dueSoon ? (
                <StatusBadge size="compact" tone="warning">
                  Срок &lt; 1 дня
                </StatusBadge>
              ) : null}
            </div>
            <dl className="grid grid-cols-1 gap-x-portal-4 gap-y-1 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-portal-caption text-portal-muted">Назначил</dt>
                <dd className="truncate text-portal-text">{task.createdByLabel}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-portal-caption text-portal-muted">Ответственный</dt>
                <dd className="truncate text-portal-text">{task.responsibleLabel}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-portal-caption text-portal-muted">Исполнитель</dt>
                <dd className="truncate text-portal-text">{task.executorLabel}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-portal-caption text-portal-muted">Срок</dt>
                <dd
                  className={
                    task.overdue || task.dueSoon
                      ? "font-medium text-portal-danger"
                      : "text-portal-text"
                  }
                >
                  {task.dueLabel}
                </dd>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-portal-caption text-portal-muted">Цех / объект</dt>
                <dd className="truncate text-portal-text">
                  {task.workshopLabel}
                  <span aria-hidden> · </span>
                  {task.objectHref ? (
                    <Link
                      href={task.objectHref}
                      className="underline-offset-2 hover:underline"
                    >
                      {task.objectLabel}
                    </Link>
                  ) : (
                    task.objectLabel
                  )}
                </dd>
              </div>
            </dl>
          </div>
          {showBackLink ? (
            <Link
              href="/sales/tasks"
              className="shrink-0 text-sm text-portal-muted underline-offset-2 hover:underline"
            >
              ← К списку
            </Link>
          ) : null}
        </div>
      </header>

      <div
        ref={historyRef}
        className="min-h-0 flex-1 space-y-portal-3 overflow-y-auto bg-[radial-gradient(#e8edf5_1px,transparent_1px)] bg-[length:14px_14px] p-portal-4"
        aria-label="История сообщений задачи"
      >
        {messagesError ? (
          <EmptyState
            title="Не удалось загрузить сообщения"
            description={messagesError}
            size="compact"
          />
        ) : messages.length === 0 ? (
          <EmptyState
            title="Пока нет сообщений"
            description="Напишите первое сообщение или прикрепите изображение."
            size="compact"
          />
        ) : (
          messages.map((message) => {
            const mine = isWorkTaskMessageMine(
              message.authorPlatformUserId,
              viewerUserId,
            );
            const authorLabel = mine ? "Вы" : message.authorLabel;
            return (
              <div
                key={message.id}
                className={`flex w-full ${mine ? "justify-end" : "justify-start"}`}
              >
                <article
                  className={
                    mine
                      ? "max-w-[min(100%,28rem)] rounded-2xl rounded-br-md border border-portal-primary/30 bg-portal-primary-soft px-3.5 py-2.5 shadow-sm"
                      : "max-w-[min(100%,28rem)] rounded-2xl rounded-bl-md border border-portal-border bg-portal-surface-secondary px-3.5 py-2.5 shadow-sm"
                  }
                  aria-label={`Сообщение от ${authorLabel}`}
                  data-mine={mine ? "true" : "false"}
                >
                  <div
                    className={`flex items-baseline justify-between gap-2 text-[11px] ${
                      mine ? "text-portal-primary/80" : "text-portal-muted"
                    }`}
                  >
                    <span
                      className={`font-semibold ${
                        mine ? "text-portal-primary" : "text-portal-text"
                      }`}
                    >
                      {authorLabel}
                    </span>
                    <time dateTime={message.createdAt}>{message.createdLabel}</time>
                  </div>
                  {message.body ? (
                    <p className="mt-1.5 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm leading-5 text-portal-text">
                      {message.body}
                    </p>
                  ) : null}
                  {message.attachments.length > 0 ? (
                    <ul className="mt-2 space-y-1.5">
                      {message.attachments.map((item) => (
                        <li key={item.id}>
                          {item.isImage ? (
                            <button
                              type="button"
                              className="block max-w-full text-left"
                              onClick={() =>
                                setLightbox({ src: item.href, alt: item.filename })
                              }
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.href}
                                alt={item.filename}
                                className="max-h-56 max-w-full cursor-zoom-in rounded-lg border border-portal-border object-contain"
                              />
                            </button>
                          ) : (
                            <a
                              href={item.href}
                              className="flex items-center gap-2 rounded-lg bg-portal-surface px-2.5 py-1.5 text-xs text-portal-text underline-offset-2 hover:underline"
                              target="_blank"
                              rel="noreferrer"
                            >
                              <span className="min-w-0 flex-1 truncate">
                                {item.filename}
                              </span>
                              <span className="shrink-0 text-portal-muted">
                                {item.sizeLabel}
                              </span>
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              </div>
            );
          })
        )}
      </div>

      <footer className="shrink-0 border-t border-portal-border bg-portal-surface-secondary px-portal-4 py-portal-3">
        <form onSubmit={onSubmit} className="space-y-2">
          {previewUrl ? (
            <div className="flex items-start gap-2 rounded-md border border-portal-border bg-portal-surface p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={file?.name ?? "preview"}
                className="h-16 w-16 rounded object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-portal-text">{file?.name}</p>
                <button
                  type="button"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-portal-muted hover:text-portal-text"
                  onClick={clearFile}
                  disabled={busy}
                >
                  <X size={12} aria-hidden />
                  Убрать
                </button>
              </div>
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={onFileChange}
              disabled={busy}
            />
            <IconButton
              type="button"
              variant="secondary"
              label="Прикрепить изображение"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus size={16} />
            </IconButton>
            <textarea
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setError("");
              }}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder="Сообщение… Enter — отправить, Shift+Enter — новая строка"
              className="min-h-12 w-full flex-1 resize-y rounded-md border border-portal-border bg-portal-surface px-3 py-2 text-sm text-portal-text placeholder:text-portal-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary"
              disabled={busy}
              aria-label="Текст сообщения"
            />
            <Button type="submit" disabled={busy}>
              <Send size={14} aria-hidden />
              {busy ? "…" : "Отправить"}
            </Button>
          </div>
          {error ? (
            <p className="text-sm text-portal-danger" role="alert">
              {error}
            </p>
          ) : (
            <p className="text-[11px] text-portal-muted">
              jpeg / png / webp / gif, до 10 МБ
            </p>
          )}
        </form>
      </footer>
    </div>
  );
}
