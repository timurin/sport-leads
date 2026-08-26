"use client";

import { Paperclip, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { LeadMessageDraft } from "@/components/sales/lead-communication-panel";
import { Button, IconButton } from "@/components/ui/button";
import {
  activityAllowsReply,
  activityChannelForThread,
  activityIsTaskEvent,
  activityOpensInEventModal,
  formatActivityDate,
} from "@/lib/sales/lead-activity";
import {
  buildLeadChannelThread,
  canSendLeadMessage,
  formatAttachmentSize,
  formatLeadMessageDate,
  getLeadMessageDestination,
  leadMessageChannelLabels,
} from "@/lib/sales/lead-message";
import type {
  LeadActivity,
  LeadContact,
  LeadMessage,
  LeadMessageAttachment,
  LeadMessageChannel,
} from "@/types/sales";

const clientChannels: LeadMessageChannel[] = ["phone", "email", "telegram", "whatsapp", "vk", "website"];
const composeChannels: LeadMessageChannel[] = [...clientChannels, "internal"];
const templates = [
  { label: "Первичный ответ", text: "Здравствуйте! Спасибо за обращение. Уточните, пожалуйста, необходимое количество комплектов и желаемую дату готовности." },
  { label: "Уточнение деталей", text: "Добрый день! Подскажите, пожалуйста, размеры, количество изделий и требования к нанесению." },
  { label: "Отправка предложения", text: "Добрый день! Подготовили предварительное предложение. Готовы обсудить состав комплекта, нанесение и сроки производства." },
  { label: "Напоминание", text: "Здравствуйте! Напоминаем о нашем предложении. Подскажите, удалось ли ознакомиться и остались ли вопросы?" },
];

function localAttachmentId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `lead-attachment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export type LeadEventModalState =
  | { kind: "compose" }
  | { kind: "view"; activity: LeadActivity };

export function LeadEventModal({
  state,
  leadId,
  messages = [],
  activities = [],
  primaryContact,
  customerWebsite,
  persistent = false,
  onClose,
  onSend,
  onSendInternal,
  onAddTask,
}: {
  state: LeadEventModalState;
  leadId: string;
  messages?: LeadMessage[];
  activities?: LeadActivity[];
  primaryContact?: LeadContact;
  customerWebsite?: string;
  persistent?: boolean;
  onClose: () => void;
  onSend: (draft: LeadMessageDraft) => void | Promise<string | null>;
  onSendInternal: (body: string) => Promise<string | null>;
  onAddTask: () => void;
}) {
  const activity = state.kind === "view" ? state.activity : null;
  const viewThreadChannel = activity ? activityChannelForThread(activity) : null;
  const replyAllowed = activity ? activityAllowsReply(activity) : true;
  const isTask = activity ? activityIsTaskEvent(activity) : false;
  const showComposer = state.kind === "compose" || replyAllowed;
  const lockedChannel: LeadMessageChannel | null = viewThreadChannel;
  const [mounted, setMounted] = useState(false);
  const [channel, setChannel] = useState<LeadMessageChannel>(() => {
    if (lockedChannel) return lockedChannel;
    const preferred = primaryContact?.preferredChannel;
    if (preferred && preferred !== "unspecified" && (clientChannels as ReadonlyArray<string>).includes(preferred)) {
      return preferred;
    }
    return "email";
  });
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<LeadMessageAttachment[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const destination = getLeadMessageDestination(channel, primaryContact, customerWebsite);
  const isInternal = channel === "internal";
  const sendEnabled = isInternal ? !sending : canSendLeadMessage(channel, destination) && !sending;
  const threadChannel = viewThreadChannel ?? (state.kind === "compose" ? channel : null);
  const threadItems = useMemo(
    () => (threadChannel ? buildLeadChannelThread(threadChannel, messages, activities) : []),
    [activities, messages, threadChannel],
  );
  const openedItemId = activity
    ? (activity.metadata?.messageId !== undefined ? `message-${activity.metadata.messageId}` : activity.id)
    : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !openedItemId) return;
    panelRef.current?.querySelector(`[data-thread-item="${openedItemId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [mounted, openedItemId, threadItems.length]);

  useEffect(() => {
    if (!mounted) return;
    const closeButton = panelRef.current?.querySelector<HTMLButtonElement>('button[aria-label="Закрыть"]');
    closeButton?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [mounted, onClose]);

  function addFiles(fileList: FileList | null) {
    if (!fileList?.length || isInternal) return;
    const files = Array.from(fileList);
    if (attachments.length + files.length > 5) {
      setError("Можно прикрепить не более 5 файлов.");
      return;
    }
    if (files.some((file) => file.size > 20 * 1024 * 1024)) {
      setError("Размер каждого файла не должен превышать 20 МБ.");
      return;
    }
    setAttachments((current) => [
      ...current,
      ...files.map((file) => ({
        id: localAttachmentId(),
        name: file.name,
        type: file.type || undefined,
        size: file.size,
      })),
    ]);
    setError("");
  }

  async function send() {
    const trimmed = text.trim();
    if (sending) return;
    if (isInternal) {
      if (!trimmed) {
        setError("Введите текст внутреннего сообщения.");
        return;
      }
      if (trimmed.length > 5000) {
        setError("Сообщение не должно превышать 5000 символов.");
        return;
      }
      setSending(true);
      setError("");
      setNotice("");
      try {
        const result = await onSendInternal(trimmed);
        if (result) {
          setError(result);
          return;
        }
        setText("");
        setNotice("Внутреннее сообщение сохранено.");
      } finally {
        setSending(false);
      }
      return;
    }
    if (!canSendLeadMessage(channel, destination)) {
      setError(destination ? "Для этого канала отправка клиенту недоступна." : "Для этого канала контакт не указан.");
      return;
    }
    if (text.length > 5000) {
      setError("Сообщение не должно превышать 5000 символов.");
      return;
    }
    if (!trimmed && attachments.length === 0) {
      setError("Введите сообщение или прикрепите файл.");
      return;
    }
    setSending(true);
    setError("");
    setNotice("");
    try {
      const result = await onSend({
        channel,
        text: trimmed,
        recipientName: primaryContact?.name,
        attachments: attachments.map((attachment) => ({ ...attachment })),
      });
      if (typeof result === "string" && result) {
        setError(result);
        return;
      }
      setText("");
      setAttachments([]);
      setNotice(
        persistent
          ? "Сообщение сохранено (mock-отправка). Реальный внешний канал не вызывался."
          : "Сообщение сохранено локально. Реальная отправка не выполнялась.",
      );
    } finally {
      setSending(false);
    }
  }

  if (!mounted) return null;
  if (activity && !activityOpensInEventModal(activity)) return null;

  return createPortal(
    <div className="fixed inset-0 z-portal-modal-3" data-lead-event-modal data-lead-id={leadId}>
      <button
        type="button"
        className="absolute inset-0 bg-[#101828]/45"
        aria-label="Закрыть событие"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-event-modal-title"
        ref={panelRef}
        className="absolute inset-y-0 right-0 flex w-[50vw] min-w-[20rem] max-w-full flex-col bg-portal-page shadow-portal-overlay"
      >
        <div className="flex items-start justify-between gap-3 border-b border-portal-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="lead-event-modal-title" className="text-base font-semibold text-portal-text">
              {threadChannel
                ? `Переписка · ${leadMessageChannelLabels[threadChannel]}`
                : state.kind === "compose"
                  ? "Написать"
                  : activity?.title ?? "Событие"}
            </h2>
            {threadChannel ? (
              <p className="mt-1 text-xs text-portal-muted">Вся ветка этого канала по лиду</p>
            ) : activity ? (
              <p className="mt-1 text-xs text-portal-muted">
                {activity.channel ? `${leadMessageChannelLabels[activity.channel]} · ` : ""}
                {formatActivityDate(activity.occurredAt)}
              </p>
            ) : (
              <p className="mt-1 text-xs text-portal-muted">Новое сообщение клиенту или команде</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {threadChannel || isTask ? (
              <Button type="button" size="compact" onClick={onAddTask}>Создать задачу</Button>
            ) : null}
            <IconButton label="Закрыть" onClick={onClose} className="border border-portal-border bg-portal-surface">
              <X size={18} aria-hidden="true" />
            </IconButton>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {threadChannel ? (
            <section className="mb-4" data-lead-channel-thread data-thread-channel={threadChannel} aria-label={`Переписка канала ${leadMessageChannelLabels[threadChannel]}`}>
              {threadItems.length ? threadItems.map((item) => {
                const incoming = item.direction === "incoming";
                const opened = Boolean(openedItemId && (item.id === openedItemId || item.id === activity?.id));
                return (
                  <article
                    key={item.id}
                    data-thread-item={item.id}
                    className={`lead-feed-card ${opened ? "is-opened" : ""}`}
                    aria-current={opened ? "true" : undefined}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 text-xs text-slate-500">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800">{item.authorName ?? (incoming ? "Клиент" : "Вы")}</p>
                        {item.recipientName ? <p className="mt-0.5">Кому: {item.recipientName}</p> : null}
                      </div>
                      <p className="shrink-0 text-right">
                        {incoming ? "получено" : "отправлено"} {formatLeadMessageDate(item.occurredAt)}
                        {item.statusLabel ? ` · ${item.statusLabel}` : ""}
                      </p>
                    </div>
                    {item.text ? <p className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm leading-6 text-portal-text">{item.text}</p> : null}
                    {item.attachments?.length ? (
                      <ul className="mt-2 space-y-1.5">
                        {item.attachments.map((attachment) => (
                          <li key={attachment.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">
                            <Paperclip size={14} />
                            <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                            {attachment.sizeLabel ? <span className="text-slate-500">{attachment.sizeLabel}</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                );
              }) : (
                <p className="py-4 text-center text-sm text-slate-500">В этом канале переписки пока нет</p>
              )}
            </section>
          ) : activity ? (
            <section className="mb-4 rounded-portal-md border border-portal-border bg-portal-surface p-3">
              {activity.description ? (
                <p className="whitespace-pre-wrap text-sm leading-6 text-portal-text">{activity.description}</p>
              ) : (
                <p className="text-sm text-portal-muted">Текст события отсутствует.</p>
              )}
              {activity.attachments?.length ? (
                <ul className="mt-3 space-y-2" aria-label="Вложения">
                  {activity.attachments.map((attachment) => (
                    <li key={attachment.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <p className="font-medium text-slate-800">{attachment.name}</p>
                      <p className="text-xs text-slate-500">{attachment.mediaType}{attachment.sizeLabel ? ` · ${attachment.sizeLabel}` : ""}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {isTask && !threadChannel ? (
            <div className="mb-4">
              <Button type="button" onClick={onAddTask}>Добавить задачу</Button>
            </div>
          ) : null}

          {showComposer ? (
            <section aria-label="Написать или ответить">
              <label htmlFor="lead-event-message-text" className="sr-only">Текст сообщения</label>
              <textarea
                id="lead-event-message-text"
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setError(event.target.value.length > 5000 ? "Сообщение не должно превышать 5000 символов." : "");
                }}
                rows={6}
                placeholder={
                  threadChannel
                    ? `Написать ответ в канале ${leadMessageChannelLabels[threadChannel]}…`
                    : isInternal
                      ? "Сообщение команде…"
                      : "Что написать клиенту…"
                }
                className="min-h-28 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              {attachments.length && !isInternal ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <li key={attachment.id} className="inline-flex max-w-full items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
                      <Paperclip size={14} />
                      <span className="truncate">{attachment.name}</span>
                      <span>{formatAttachmentSize(attachment.size)}</span>
                      <button type="button" onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))} aria-label={`Удалить вложение ${attachment.name}`}>
                        <X size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {error ? <p role="alert" className="mt-2 text-sm font-medium text-red-700">{error}</p> : null}
              {notice ? <p role="status" className="mt-2 text-sm text-slate-600">{notice}</p> : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button type="button" variant="primary" onClick={() => void send()} disabled={!sendEnabled}>
                  {sending ? "Отправка…" : "Отправить"}
                </Button>
                <label className="text-xs font-medium text-slate-500">
                  <span className="sr-only">Канал</span>
                  <select
                    value={channel}
                    disabled={Boolean(lockedChannel)}
                    onChange={(event) => setChannel(event.target.value as LeadMessageChannel)}
                    className="h-10 rounded-[var(--portal-radius-md)] border border-portal-border bg-portal-surface px-2 text-sm text-portal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {(lockedChannel ? [channel] : composeChannels).map((item) => (
                      <option key={item} value={item}>{leadMessageChannelLabels[item]}</option>
                    ))}
                  </select>
                </label>
              </div>
              {!isInternal ? (
                <p className="mt-1.5 truncate text-[11px] text-slate-500">
                  {sendEnabled ? destination : destination ? "Отправка в этом канале недоступна" : "Для канала не указан контакт"}
                </p>
              ) : (
                <p className="mt-1.5 text-[11px] text-slate-500">Внутренний канал · без отправки клиенту</p>
              )}
              {!isInternal ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-slate-500">Файл и шаблоны</summary>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[var(--portal-radius-md)] border border-portal-border px-3 text-xs font-medium text-portal-text hover:bg-portal-surface-secondary">
                      <Paperclip size={14} />Файл
                      <input type="file" multiple className="sr-only" onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
                    </label>
                    <select
                      defaultValue=""
                      onChange={(event) => {
                        if (event.target.value) setText(event.target.value);
                        event.target.value = "";
                      }}
                      className="h-9 rounded-[var(--portal-radius-md)] border border-portal-border bg-portal-surface px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <option value="" disabled>Шаблоны</option>
                      {templates.map((template) => (
                        <option key={template.label} value={template.text}>{template.label}</option>
                      ))}
                    </select>
                  </div>
                </details>
              ) : null}
            </section>
          ) : (
            <p className="text-sm text-portal-muted">Для этого события ответ недоступен.</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
