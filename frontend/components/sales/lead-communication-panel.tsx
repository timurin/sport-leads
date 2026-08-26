"use client";

import { Clipboard, FileText, MessageSquareReply, Paperclip, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  canSendLeadMessage,
  filterLeadMessages,
  formatAttachmentSize,
  formatLeadMessageDate,
  getLeadMessageDestination,
  leadMessageChannelLabels,
  leadMessageStatusLabels,
} from "@/lib/sales/lead-message";
import type { LeadContact, LeadMessage, LeadMessageAttachment, LeadMessageChannel } from "@/types/sales";

export type LeadMessageDraft = {
  channel: LeadMessageChannel;
  text: string;
  recipientName?: string;
  attachments: LeadMessageAttachment[];
};

const channels: LeadMessageChannel[] = ["phone", "email", "telegram", "whatsapp", "vk", "website"];
const templates = [
  { label: "Первичный ответ", text: "Здравствуйте! Спасибо за обращение. Уточните, пожалуйста, необходимое количество комплектов и желаемую дату готовности." },
  { label: "Уточнение деталей", text: "Добрый день! Подскажите, пожалуйста, размеры, количество изделий и требования к нанесению." },
  { label: "Отправка предложения", text: "Добрый день! Подготовили предварительное предложение. Готовы обсудить состав комплекта, нанесение и сроки производства." },
  { label: "Напоминание", text: "Здравствуйте! Напоминаем о нашем предложении. Подскажите, удалось ли ознакомиться и остались ли вопросы?" },
];

function emptyDrafts() {
  return Object.fromEntries(channels.map((channel) => [channel, ""])) as Record<LeadMessageChannel, string>;
}

function emptyAttachments() {
  return Object.fromEntries(channels.map((channel) => [channel, [] as LeadMessageAttachment[]])) as Record<LeadMessageChannel, LeadMessageAttachment[]>;
}

function localAttachmentId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `lead-attachment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function LeadCommunicationPanel({
  messages,
  primaryContact,
  customerWebsite,
  onSend,
  onAddTask,
  nextTask = null,
  embedded = false,
  persistent = false,
}: {
  messages: LeadMessage[];
  primaryContact?: LeadContact;
  customerWebsite?: string;
  onSend: (draft: LeadMessageDraft) => void | Promise<string | null>;
  onAddTask?: () => void;
  nextTask?: { title: string; dueLabel: string; assignee?: string } | null;
  embedded?: boolean;
  persistent?: boolean;
}) {
  const initialChannel = primaryContact?.preferredChannel;
  const [channel, setChannel] = useState<LeadMessageChannel>(
    initialChannel &&
      initialChannel !== "unspecified" &&
      (channels as ReadonlyArray<string>).includes(initialChannel)
      ? initialChannel
      : "email",
  );
  const [drafts, setDrafts] = useState(emptyDrafts);
  const [attachmentDrafts, setAttachmentDrafts] = useState(emptyAttachments);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const visibleMessages = useMemo(() => filterLeadMessages(messages, "all"), [messages]);
  const destination = getLeadMessageDestination(channel, primaryContact, customerWebsite);
  const draft = drafts[channel];
  const attachments = attachmentDrafts[channel];
  const sendEnabled = canSendLeadMessage(channel, destination) && !sending;

  useEffect(() => {
    const history = historyRef.current;
    if (history) history.scrollTop = history.scrollHeight;
  }, [visibleMessages.length]);

  function changeChannel(nextChannel: LeadMessageChannel) {
    setChannel(nextChannel);
    setError("");
    setNotice("");
  }

  function selectTemplate(text: string) {
    if (!text) return;
    setDrafts((current) => ({ ...current, [channel]: text }));
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const files = Array.from(fileList);
    if (attachments.length + files.length > 5) {
      setError("Можно прикрепить не более 5 файлов.");
      return;
    }
    if (files.some((file) => file.size > 20 * 1024 * 1024)) {
      setError("Размер каждого файла не должен превышать 20 МБ.");
      return;
    }
    setAttachmentDrafts((current) => ({
      ...current,
      [channel]: [...current[channel], ...files.map((file) => ({ id: localAttachmentId(), name: file.name, type: file.type || undefined, size: file.size }))],
    }));
    setError("");
  }

  function removeAttachment(id: string) {
    setAttachmentDrafts((current) => ({ ...current, [channel]: current[channel].filter((attachment) => attachment.id !== id) }));
  }

  async function sendMessage() {
    const text = draft.trim();
    if (!canSendLeadMessage(channel, destination) || sending) {
      setError(destination ? "Для этого канала отправка клиенту недоступна." : "Для этого канала контакт не указан.");
      return;
    }
    if (draft.length > 5000) {
      setError("Сообщение не должно превышать 5000 символов.");
      return;
    }
    if (!text && attachments.length === 0) {
      setError("Введите сообщение или прикрепите файл.");
      return;
    }
    setSending(true);
    setError("");
    setNotice("");
    try {
      const result = await onSend({
        channel,
        text,
        recipientName: primaryContact?.name,
        attachments: attachments.map((attachment) => ({ ...attachment })),
      });
      if (typeof result === "string" && result) {
        setError(result);
        return;
      }
      setDrafts((current) => ({ ...current, [channel]: "" }));
      setAttachmentDrafts((current) => ({ ...current, [channel]: [] }));
      setNotice(
        persistent
          ? "Сообщение сохранено (mock-отправка). Реальный внешний канал не вызывался."
          : "Сообщение сохранено локально. Реальная отправка не выполнялась.",
      );
    } finally {
      setSending(false);
    }
  }

  function reply(message: LeadMessage) {
    changeChannel(message.channel);
    setDrafts((current) => ({ ...current, [message.channel]: current[message.channel] || `Ответ для ${message.senderName ?? "клиента"}: ` }));
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Текст скопирован.");
      setError("");
    } catch {
      setError("Не удалось скопировать текст. Проверьте разрешение браузера.");
    }
  }

  return (
    <section className={`${embedded ? "bg-portal-surface" : "rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface shadow-[var(--portal-shadow-card)]"} lead-communication-panel min-w-0`} aria-labelledby="lead-communication-heading">
      <h2 id="lead-communication-heading" className="sr-only">Коммуникации</h2>
      <div className="min-w-0 p-3.5">
        <label htmlFor="lead-message-text" className="sr-only">Сообщение клиенту</label>
        <textarea id="lead-message-text" ref={textareaRef} value={draft} onChange={(event) => { setDrafts((current) => ({ ...current, [channel]: event.target.value })); setError(event.target.value.length > 5000 ? "Сообщение не должно превышать 5000 символов." : ""); }} aria-invalid={draft.length > 5000} aria-describedby="lead-message-error" rows={3} placeholder="Что сделать или написать клиенту…" className="min-h-16 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" />
        {attachments.length ? <ul className="mt-3 flex flex-wrap gap-2">{attachments.map((attachment) => <li key={attachment.id} className="inline-flex max-w-full items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700"><Paperclip size={14} /><span className="truncate">{attachment.name}</span><span>{formatAttachmentSize(attachment.size)}</span><button type="button" onClick={() => removeAttachment(attachment.id)} aria-label={`Удалить вложение ${attachment.name}`} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X size={15} /></button></li>)}</ul> : null}
        {error ? <p id="lead-message-error" role="alert" className="mt-2 text-sm font-medium text-red-700">{error}</p> : <span id="lead-message-error" />}
        {notice ? <p role="status" className="mt-2 text-sm text-slate-600">{notice}</p> : null}
        <div className="lead-composer-actions mt-2">
          <Button type="button" variant="primary" onClick={() => void sendMessage()} disabled={!sendEnabled} aria-label={persistent ? "Отправить сообщение" : "Отправить сообщение локально"}>{sending ? "Отправка…" : "Отправить"}</Button>
          {onAddTask ? <Button type="button" onClick={onAddTask}>Задача</Button> : null}
          <label className="text-xs font-medium text-slate-500">
            <span className="sr-only">Канал</span>
            <select value={channel} onChange={(event) => changeChannel(event.target.value as LeadMessageChannel)} className="h-10 rounded-[var(--portal-radius-md)] border border-portal-border bg-portal-surface px-2 text-sm text-portal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              {channels.map((item) => <option key={item} value={item}>{leadMessageChannelLabels[item]}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-1.5 truncate text-[11px] text-slate-500">{sendEnabled ? destination : destination ? "Отправка в этом канале недоступна" : "Для канала не указан контакт"}</p>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-slate-500">Файл и шаблоны</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[var(--portal-radius-md)] border border-portal-border px-3 text-xs font-medium text-portal-text hover:bg-portal-surface-secondary"><Paperclip size={14} />Файл<input type="file" multiple className="sr-only" onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} /></label>
            <select defaultValue="" onChange={(event) => { selectTemplate(event.target.value); event.target.value = ""; }} className="h-9 rounded-[var(--portal-radius-md)] border border-portal-border bg-portal-surface px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><option value="" disabled>Шаблоны</option>{templates.map((template) => <option key={template.label} value={template.text}>{template.label}</option>)}</select>
          </div>
        </details>
      </div>
      <div ref={historyRef} data-lead-message-list className="max-h-[28rem] min-h-0 space-y-0 overflow-y-auto px-3.5 pb-3.5" aria-label="История переписки">
        {nextTask ? (
          <article className="lead-feed-card is-next-task">
            <div className="text-xs font-bold text-slate-800">Задача · срок {nextTask.dueLabel}</div>
            <div className="mt-1 text-sm text-portal-text">{nextTask.title}</div>
            {nextTask.assignee ? <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-slate-500"><span>{nextTask.assignee}</span></div> : null}
          </article>
        ) : null}
        {visibleMessages.length === 0 && !nextTask ? (
          <p className="py-6 text-center text-sm text-slate-500">Переписка пока отсутствует</p>
        ) : visibleMessages.map((message) => {
          const incoming = message.direction === "incoming";
          const status = message.status ? leadMessageStatusLabels[message.status] : undefined;
          return (
            <article key={message.id} className="lead-feed-card group" aria-label={`${incoming ? "Входящее" : "Исходящее"} сообщение, ${leadMessageChannelLabels[message.channel]}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>{incoming ? "Входящее" : "Исходящее"} · {formatLeadMessageDate(message.sentAt)}</span>
                <span>{leadMessageChannelLabels[message.channel]}{status ? ` · ${status}` : ""}</span>
              </div>
              {message.text ? <p className="mt-1.5 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm leading-5 text-portal-text">{message.text}</p> : null}
              {message.attachments?.length ? <ul className="mt-2 space-y-1.5">{message.attachments.map((attachment) => <li key={attachment.id} className="flex items-center gap-2 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs text-slate-700 ring-1 ring-slate-200"><FileText size={14} aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{attachment.name}</span><span className="text-slate-500">{formatAttachmentSize(attachment.size)}</span></li>)}</ul> : null}
              <div className="mt-2 flex flex-wrap gap-3 text-xs font-medium">
                {incoming ? <button type="button" onClick={() => reply(message)} className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><MessageSquareReply size={14} />Ответить</button> : null}
                {message.text ? <button type="button" onClick={() => copyText(message.text)} aria-label="Копировать текст сообщения" className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Clipboard size={14} />Копировать текст</button> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
