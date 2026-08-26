"use client";

import { Check, Clipboard, FileText, MessageSquareReply, Paperclip, Send, X } from "lucide-react";
import type { ReactNode } from "react";
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
  type LeadMessageFilter,
} from "@/lib/sales/lead-message";
import type { LeadContact, LeadMessage, LeadMessageAttachment, LeadMessageChannel } from "@/types/sales";

export type LeadMessageDraft = {
  channel: LeadMessageChannel;
  text: string;
  recipientName?: string;
  attachments: LeadMessageAttachment[];
};

const channels: LeadMessageChannel[] = ["phone", "email", "telegram", "whatsapp", "vk", "website"];
const filters: Array<{ id: LeadMessageFilter; label: string }> = [
  { id: "all", label: "Все" },
  { id: "telegram", label: "Telegram" },
  { id: "email", label: "Email" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "vk", label: "VK" },
];
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
  embedded = false,
  customerSummary,
  persistent = false,
}: {
  messages: LeadMessage[];
  primaryContact?: LeadContact;
  customerWebsite?: string;
  onSend: (draft: LeadMessageDraft) => void | Promise<string | null>;
  embedded?: boolean;
  customerSummary?: ReactNode;
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
  const [filter, setFilter] = useState<LeadMessageFilter>("all");
  const [drafts, setDrafts] = useState(emptyDrafts);
  const [attachmentDrafts, setAttachmentDrafts] = useState(emptyAttachments);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const visibleMessages = useMemo(() => filterLeadMessages(messages, filter), [messages, filter]);
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
      <div className="border-b border-portal-border bg-portal-surface px-3.5 py-2.5">
        <div className="flex flex-wrap gap-1.5" aria-label="Каналы коммуникации">
          {channels.map((item) => {
            const itemDestination = getLeadMessageDestination(item, primaryContact, customerWebsite);
            const available = canSendLeadMessage(item, itemDestination);
            return (
              <button key={item} type="button" onClick={() => changeChannel(item)} aria-pressed={channel === item} title={available ? "доступен" : "не настроен"} className={`rounded-full px-2.5 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${channel === item ? "bg-blue-50 text-blue-800 ring-1 ring-blue-300" : "bg-portal-surface-secondary text-slate-600 hover:bg-slate-100"}`}>
                {leadMessageChannelLabels[item]}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 truncate text-[11px] text-slate-500">{sendEnabled ? destination : destination ? "Отправка в этом канале недоступна" : "Для канала не указан контакт"}</p>
      </div>

      <div className={customerSummary ? "lead-communication-body grid min-w-0" : "min-w-0"}>
        {customerSummary ? <aside className="lead-client-summary min-w-0 border-b border-portal-border bg-portal-surface">{customerSummary}</aside> : null}
        <div className="min-w-0">
      <div className="border-b border-portal-border bg-portal-surface p-3">
        <label htmlFor="lead-message-text" className="text-sm font-medium text-slate-800">Написать · {leadMessageChannelLabels[channel]}</label>
        <textarea id="lead-message-text" ref={textareaRef} value={draft} onChange={(event) => { setDrafts((current) => ({ ...current, [channel]: event.target.value })); setError(event.target.value.length > 5000 ? "Сообщение не должно превышать 5000 символов." : ""); }} aria-invalid={draft.length > 5000} aria-describedby="lead-message-help lead-message-error" rows={3} placeholder="Что написать клиенту или поставить в работу…" className="mt-2 min-h-16 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" />
        <div id="lead-message-help" className="mt-1 flex justify-between gap-3 text-xs text-slate-500"><span>{draft.length}/5000</span></div>
        {attachments.length ? <ul className="mt-3 flex flex-wrap gap-2">{attachments.map((attachment) => <li key={attachment.id} className="inline-flex max-w-full items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700"><Paperclip size={14} /><span className="truncate">{attachment.name}</span><span>{formatAttachmentSize(attachment.size)}</span><button type="button" onClick={() => removeAttachment(attachment.id)} aria-label={`Удалить вложение ${attachment.name}`} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X size={15} /></button></li>)}</ul> : null}
        {error ? <p id="lead-message-error" role="alert" className="mt-2 text-sm font-medium text-red-700">{error}</p> : <span id="lead-message-error" />}
        {notice ? <p role="status" className="mt-2 text-sm text-slate-600">{notice}</p> : null}
        <div className="lead-composer-actions mt-3 flex flex-wrap items-center gap-2">
          <label className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--portal-radius-md)] border border-portal-border bg-portal-surface px-4 text-sm font-medium text-portal-text hover:bg-portal-surface-secondary focus-within:ring-2 focus-within:ring-blue-500 sm:w-auto"><Paperclip size={16} />Прикрепить файл<input type="file" multiple className="sr-only" onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} /></label>
          <label className="w-full min-w-0 text-sm font-medium text-portal-text sm:w-auto"><span className="sr-only">Шаблоны сообщений</span><select defaultValue="" onChange={(event) => { selectTemplate(event.target.value); event.target.value = ""; }} className="h-10 w-full max-w-full rounded-[var(--portal-radius-md)] border border-portal-border bg-portal-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:w-auto"><option value="" disabled>Шаблоны</option>{templates.map((template) => <option key={template.label} value={template.text}>{template.label}</option>)}</select></label>
          <Button type="button" variant="primary" onClick={() => void sendMessage()} disabled={!sendEnabled} aria-label={persistent ? "Отправить сообщение" : "Отправить сообщение локально"} className="w-full sm:ml-auto sm:w-auto"><Send size={16} />{sending ? "Отправка…" : "Отправить"}</Button>
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto overflow-y-hidden border-b border-portal-border px-3.5 py-2" aria-label="Фильтр переписки">
        {filters.map((item) => (
          <button key={item.id} type="button" onClick={() => setFilter(item.id)} aria-pressed={filter === item.id} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${filter === item.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{item.label}</button>
        ))}
      </div>
      <div ref={historyRef} data-lead-message-list className="h-[320px] min-h-56 space-y-3 overflow-y-auto bg-[radial-gradient(#e8edf5_1px,transparent_1px)] bg-[length:14px_14px] p-3 sm:p-4 lg:h-[360px]" aria-label="История переписки">
        {visibleMessages.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center text-center"><p className="font-semibold text-slate-900">Переписка пока отсутствует</p><p className="mt-1 text-sm text-slate-500">Входящие и исходящие сообщения появятся здесь.</p></div>
        ) : visibleMessages.map((message) => {
          const incoming = message.direction === "incoming";
          const status = message.status ? leadMessageStatusLabels[message.status] : undefined;
          return (
            <article key={message.id} className={`group flex ${incoming ? "justify-start" : "justify-end"}`} aria-label={`${incoming ? "Входящее" : "Исходящее"} сообщение, ${leadMessageChannelLabels[message.channel]}`}>
              <div className={`w-[92%] min-w-0 rounded-[var(--portal-radius-md)] px-3 py-2.5 shadow-[var(--portal-shadow-sm)] sm:w-[74%] ${incoming ? "bg-portal-surface" : "bg-emerald-50"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{incoming ? message.senderName ?? "Клиент" : message.author?.name ?? "Менеджер"} · {incoming ? "Входящее" : "Исходящее"}</span>
                  <time dateTime={message.sentAt}>{formatLeadMessageDate(message.sentAt)}</time>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{leadMessageChannelLabels[message.channel]}</span>{status ? <span className={`inline-flex items-center gap-1 font-medium ${message.status === "failed" ? "text-red-700" : "text-slate-500"}`}>{message.status === "read" ? <Check size={14} aria-hidden="true" /> : null}{status}</span> : null}</div>
                {message.text ? <p className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm leading-5 text-portal-text">{message.text}</p> : null}
                {message.attachments?.length ? <ul className="mt-2 space-y-1.5">{message.attachments.map((attachment) => <li key={attachment.id} className="flex items-center gap-2 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs text-slate-700 ring-1 ring-slate-200"><FileText size={14} aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{attachment.name}</span><span className="text-slate-500">{formatAttachmentSize(attachment.size)}</span></li>)}</ul> : null}
                <div className="mt-2 flex flex-wrap gap-3 text-xs font-medium opacity-70 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                  {incoming ? <button type="button" onClick={() => reply(message)} className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><MessageSquareReply size={14} />Ответить</button> : null}
                  {message.text ? <button type="button" onClick={() => copyText(message.text)} aria-label="Копировать текст сообщения" className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Clipboard size={14} />Копировать текст</button> : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
        </div>
      </div>
    </section>
  );
}
