"use client";

import { Paperclip, Send } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  createLeadCollaborationMessage,
  createOrderCollaborationMessage,
  createStandaloneTechCardCollaborationMessage,
  listCollaborationMentionCandidates,
  listLeadCollaborationMessages,
  listOrderCollaborationMessages,
  listStandaloneTechCardCollaborationMessages,
  type CollaborationMentionCandidate,
  type CollaborationMessage,
} from "@/app/(workspace)/sales/orders/[orderId]/collaboration-actions";
import { Button } from "@/components/ui/button";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { sameOriginApiMediaUrl } from "@/lib/api-media";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

function formatWhen(value: string) {
  return dateFormatter.format(new Date(value));
}

function replySnippet(message: CollaborationMessage): string {
  const text = message.body.replace(/^> [^\n]*\n+/, "").trim();
  if (text) return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  if (message.attachments?.length) return "Изображение";
  return "Сообщение";
}

function replyImages(message: CollaborationMessage) {
  return (message.attachments ?? []).flatMap((file) => {
    const src = sameOriginApiMediaUrl(file.content_url);
    return src ? [{ id: file.id, src, alt: file.filename }] : [];
  });
}

function splitQuotedReply(body: string): { quote: string | null; text: string } {
  if (!body.startsWith("> ")) return { quote: null, text: body };
  const breakAt = body.indexOf("\n");
  if (breakAt === -1) return { quote: body.slice(2), text: "" };
  return {
    quote: body.slice(2, breakAt),
    text: body.slice(breakAt + 1).replace(/^\n/, ""),
  };
}

function highlightMentions(body: string, mentions: CollaborationMessage["mentions"]) {
  if (!mentions.length) return body;
  const logins = mentions.map((m) => m.mentioned_login_snapshot);
  const pattern = new RegExp(
    `@(${logins.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );
  const parts: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(body)) !== null) {
    if (match.index > last) {
      parts.push(body.slice(last, match.index));
    }
    parts.push(
      <span
        key={`m-${key++}`}
        className="rounded bg-portal-primary-soft px-0.5 font-semibold text-portal-primary"
      >
        {match[0]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts.length ? parts : body;
}

type OrderCollaborationPanelProps = {
  orderId?: number | string;
  leadId?: number | string;
  standaloneCardId?: number | string;
  technicalCardId?: number | null;
  embedded?: boolean;
  compact?: boolean;
  customerSummary?: ReactNode;
  title?: string;
  deepLinkHref?: string | null;
  reloadToken?: string | number | null;
  /** Stretch to the parent height; message history scrolls inside the panel. */
  fillHeight?: boolean;
};

export function OrderCollaborationPanel({
  orderId,
  leadId,
  standaloneCardId,
  technicalCardId = null,
  embedded = false,
  compact = false,
  customerSummary,
  title = "Внутренняя переписка",
  deepLinkHref = null,
  reloadToken = null,
  fillHeight = false,
}: OrderCollaborationPanelProps) {
  const anchorCount = [orderId, leadId, standaloneCardId].filter(
    (value) => value != null,
  ).length;
  if (anchorCount !== 1) {
    throw new Error(
      "OrderCollaborationPanel requires exactly one of orderId, leadId, or standaloneCardId",
    );
  }
  const isLead = leadId != null;
  const isStandalone = standaloneCardId != null;
  const [messages, setMessages] = useState<CollaborationMessage[]>([]);
  const [candidates, setCandidates] = useState<CollaborationMentionCandidate[]>([]);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [replyTo, setReplyTo] = useState<CollaborationMessage | null>(null);
  const [preview, setPreview] = useState<{ src: string; alt: string } | null>(null);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const allowImages = technicalCardId != null || standaloneCardId != null;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const historyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    const [msgRes, candRes] = await Promise.all([
      isStandalone
        ? listStandaloneTechCardCollaborationMessages(standaloneCardId)
        : isLead
          ? listLeadCollaborationMessages(leadId)
          : listOrderCollaborationMessages(orderId!, technicalCardId),
      listCollaborationMentionCandidates(),
    ]);
    if (!msgRes.ok) {
      setError(msgRes.message);
      setLoading(false);
      return;
    }
    setMessages(msgRes.data);
    if (candRes.ok) setCandidates(candRes.data);
    setLoading(false);
  }, [isLead, isStandalone, leadId, orderId, standaloneCardId, technicalCardId]);

  useEffect(() => {
    void refresh();
  }, [refresh, reloadToken]);

  useEffect(() => {
    const history = historyRef.current;
    if (history) history.scrollTop = history.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    if (!showMentions) return;
    const handle = window.setTimeout(() => {
      void listCollaborationMentionCandidates(mentionQuery).then((res) => {
        if (res.ok) setCandidates(res.data);
      });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [mentionQuery, showMentions]);

  function onDraftChange(value: string) {
    setDraft(value);
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const at = /(?:^|\s)@([A-Za-z0-9_./-]*)$/.exec(before);
    if (at) {
      setShowMentions(true);
      setMentionQuery(at[1] ?? "");
    } else {
      setShowMentions(false);
      setMentionQuery("");
    }
  }

  function insertMention(candidate: CollaborationMentionCandidate) {
    const el = textareaRef.current;
    const value = draft;
    const cursor = el?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    const replaced = before.replace(/(?:^|\s)@([A-Za-z0-9_./-]*)$/, (match) => {
      const prefix = match.startsWith("@") ? "" : match[0] ?? "";
      return `${prefix}@${candidate.login} `;
    });
    const next = `${replaced}${after}`;
    setDraft(next);
    setShowMentions(false);
    setMentionQuery("");
    requestAnimationFrame(() => {
      el?.focus();
    });
  }

  async function filesToAttachments(selected: File[]) {
    return Promise.all(
      selected.map(
        (file) =>
          new Promise<{ filename: string; mime_type: string; content_base64: string }>(
            (resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const raw = String(reader.result ?? "");
                const content_base64 = raw.includes(",") ? raw.split(",")[1] ?? "" : raw;
                resolve({
                  filename: file.name,
                  mime_type: file.type || "image/png",
                  content_base64,
                });
              };
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            },
          ),
      ),
    );
  }

  function onPickImages(list: FileList | null) {
    if (!list) return;
    const next = [...files, ...Array.from(list)].slice(0, 4);
    const images = next.filter((file) => file.type.startsWith("image/"));
    if (images.length < next.length) {
      setError("Можно приложить только изображения");
    } else {
      setError("");
    }
    setFiles(images.slice(0, 4));
  }

  async function sendMessage() {
    const typed = draft.trim();
    if (busy || (!typed && files.length === 0)) return;
    const body = typed;
    setBusy(true);
    setError("");
    let attachments: Awaited<ReturnType<typeof filesToAttachments>> = [];
    try {
      attachments = allowImages ? await filesToAttachments(files) : [];
    } catch {
      setBusy(false);
      setError("Не удалось прочитать изображение");
      return;
    }
    const result = isStandalone
      ? await createStandaloneTechCardCollaborationMessage(standaloneCardId, {
          body,
          attachments,
          reply_to_message_id: replyTo?.id ?? null,
        })
      : isLead
        ? await createLeadCollaborationMessage(leadId!, {
            body,
            reply_to_message_id: replyTo?.id ?? null,
          })
        : await createOrderCollaborationMessage(orderId!, {
            body,
            technical_card_id: technicalCardId,
            attachments,
            reply_to_message_id: replyTo?.id ?? null,
          });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDraft("");
    setFiles([]);
    setReplyTo(null);
    setMessages((current) => [...current, result.data]);
  }

  function focusReply(messageId: number) {
    const node = document.getElementById(`collab-message-${messageId}`);
    node?.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightedId(messageId);
    window.setTimeout(() => {
      setHighlightedId((current) => (current === messageId ? null : current));
    }, 1400);
  }

  const shellClass = fillHeight
    ? "flex h-full min-h-0 min-w-0 flex-col"
    : embedded
    ? compact
      ? "flex min-h-0 min-w-0 flex-col"
      : "flex h-full min-h-[28rem] min-w-0 flex-col"
    : "flex min-h-[22rem] min-w-0 flex-col rounded-portal-lg border border-portal-border bg-portal-surface shadow-portal-card";

  return (
    <div className={shellClass} data-order-collaboration-panel>
      {compact ? <h3 className="sr-only">{title}</h3> : (
      <div className="flex items-center justify-between gap-2 border-b border-portal-border px-3.5 py-2.5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-portal-text">{title}</h3>
          <p className="text-[11px] text-slate-500">
            {technicalCardId
              ? `Контекст ТК #${technicalCardId}`
              : isLead
                ? "Внутренний чат по лиду"
                : isStandalone
                  ? "Внутренний чат по standalone-техкарте"
                  : "По заказу (все сообщения)"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {deepLinkHref ? (
            <a
              href={deepLinkHref}
              className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Заказ
            </a>
          ) : null}
        </div>
      </div>
      )}

      <div className={`grid min-h-0 flex-1 ${customerSummary ? "lg:grid-cols-[1fr_14rem]" : ""}`}>
        <div className="flex min-h-0 min-w-0 flex-col">
          {error ? (
            <p className="mx-3.5 mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <div ref={historyRef} className={`min-h-0 ${compact && !fillHeight ? "max-h-48" : "flex-1"} space-y-2 overflow-y-auto px-3.5 py-3`}>
            {loading ? (
              <p className="text-xs text-slate-500">Загрузка…</p>
            ) : messages.length === 0 ? (
              <p className="text-xs text-slate-500">
                Пока нет сообщений. Напишите коллегам или упомяните @login.
              </p>
            ) : (
              messages.map((message) => {
                const quoted = splitQuotedReply(message.body);
                const replyTarget = message.reply_to_message_id
                  ? messages.find((row) => row.id === message.reply_to_message_id) ?? null
                  : null;
                const replyThumbs = replyTarget ? replyImages(replyTarget) : [];
                return (
                <article
                  key={message.id}
                  id={`collab-message-${message.id}`}
                  className={`rounded-md border border-slate-100 bg-slate-50/80 px-2.5 py-2 ${highlightedId === message.id ? "ring-2 ring-slate-400" : ""}`}
                >
                  <header className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900">
                      {message.author_display_name || message.author_login}
                      <span className="font-normal text-slate-500">
                        {" "}
                        @{message.author_login}
                      </span>
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {formatWhen(message.created_at)}
                      {message.technical_card_id
                        ? ` · ТК #${message.technical_card_id}`
                        : ""}
                    </span>
                  </header>
                  {message.reply_to_message_id ? (
                    <div className="mb-1 flex min-w-0 items-center gap-2">
                      {replyThumbs.map((file) => (
                        <button
                          key={file.id}
                          type="button"
                          className="overflow-hidden rounded border border-slate-200"
                          aria-label={`Открыть ${file.alt}`}
                          onClick={() => setPreview({ src: file.src, alt: file.alt })}
                        >
                          <img src={file.src} alt="" className="size-8 object-cover" />
                        </button>
                      ))}
                      <button
                        type="button"
                        className="min-w-0 truncate text-left text-[11px] font-semibold text-slate-600 underline"
                        onClick={() => focusReply(message.reply_to_message_id!)}
                      >
                        {replyTarget
                          ? `К сообщению ${replyTarget.author_display_name || replyTarget.author_login}`
                          : "К сообщению"}
                      </button>
                    </div>
                  ) : null}
                  {quoted.quote ? (
                    <p className="mb-1 border-l-2 border-slate-300 pl-2 text-xs text-slate-500">
                      {quoted.quote}
                    </p>
                  ) : null}
                  {quoted.text ? (
                    <p className="whitespace-pre-wrap text-sm text-slate-800">
                      {highlightMentions(quoted.text, message.mentions)}
                    </p>
                  ) : null}
                  {message.attachments?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.attachments.map((file) => {
                        const src = sameOriginApiMediaUrl(file.content_url);
                        return src ? (
                          <button
                            key={file.id}
                            type="button"
                            className="overflow-hidden rounded-md border border-slate-200"
                            aria-label={`Открыть ${file.filename}`}
                            onClick={() => setPreview({ src, alt: file.filename })}
                          >
                            <img
                              src={src}
                              alt={file.filename}
                              className="h-24 w-24 object-cover"
                            />
                          </button>
                        ) : null;
                      })}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="mt-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                    onClick={() => {
                      setReplyTo(message);
                      textareaRef.current?.focus();
                    }}
                  >
                    Ответить
                  </button>
                </article>
                );
              })
            )}
          </div>

          <div className="relative shrink-0 border-t border-portal-border p-3">
            {showMentions && candidates.length > 0 ? (
              <ul className="absolute bottom-full left-3 right-3 z-10 mb-1 max-h-36 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-md">
                {candidates.slice(0, 8).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs hover:bg-slate-50"
                      onClick={() => insertMention(c)}
                    >
                      <span className="font-semibold text-slate-900">@{c.login}</span>
                      <span className="text-slate-500">{c.display_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {replyTo ? (
              <div className="mb-2 flex items-start justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                <div className="flex min-w-0 items-center gap-2">
                  {replyImages(replyTo).map((file) => (
                    <img
                      key={file.id}
                      src={file.src}
                      alt=""
                      className="size-8 shrink-0 rounded border border-slate-200 object-cover"
                    />
                  ))}
                  <p className="min-w-0">
                    <span className="font-semibold text-slate-800">
                      Ответ {replyTo.author_display_name || replyTo.author_login}
                    </span>
                    <span className="mt-0.5 block truncate">{replySnippet(replyTo)}</span>
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-sm text-slate-500 hover:text-slate-800"
                  aria-label="Отменить ответ"
                  onClick={() => setReplyTo(null)}
                >
                  ×
                </button>
              </div>
            ) : null}
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              rows={3}
              placeholder="Сообщение… Используйте @login для упоминания"
              className="w-full resize-none rounded-md border border-slate-200 px-2.5 py-2 text-sm"
              disabled={busy}
            />
            {allowImages && files.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1">
                {files.map((file) => (
                  <li key={`${file.name}-${file.size}`}>
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-700"
                      onClick={() =>
                        setFiles((current) => current.filter((item) => item !== file))
                      }
                    >
                      {file.name} ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-2 flex items-center justify-between gap-2">
              {allowImages ? (
                <label
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
                  title="Прикрепить изображение"
                >
                  <Paperclip size={16} aria-hidden="true" />
                  <span className="sr-only">Прикрепить изображение</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    multiple
                    className="sr-only"
                    disabled={busy}
                    onChange={(event) => {
                      onPickImages(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>
              ) : (
                <span />
              )}
              <Button
                type="button"
                variant="primary"
                className="h-9 px-3 text-xs"
                disabled={busy || (!draft.trim() && files.length === 0)}
                onClick={() => void sendMessage()}
              >
                <Send size={14} /> Отправить
              </Button>
            </div>
          </div>
        </div>

        {customerSummary ? (
          <div className="min-w-0 border-t border-portal-border lg:border-l lg:border-t-0">
            {customerSummary}
          </div>
        ) : null}
      </div>
      {preview ? (
        <ImageLightbox
          src={preview.src}
          alt={preview.alt}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
}
