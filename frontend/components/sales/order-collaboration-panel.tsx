"use client";

import { Send } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  createLeadCollaborationMessage,
  createOrderCollaborationMessage,
  listCollaborationMentionCandidates,
  listLeadCollaborationMessages,
  listOrderCollaborationMessages,
  type CollaborationMentionCandidate,
  type CollaborationMessage,
} from "@/app/(workspace)/sales/orders/[orderId]/collaboration-actions";
import { Button } from "@/components/ui/button";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

function formatWhen(value: string) {
  return dateFormatter.format(new Date(value));
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
  technicalCardId?: number | null;
  embedded?: boolean;
  customerSummary?: ReactNode;
  title?: string;
  deepLinkHref?: string | null;
};

export function OrderCollaborationPanel({
  orderId,
  leadId,
  technicalCardId = null,
  embedded = false,
  customerSummary,
  title = "Внутренняя переписка",
  deepLinkHref = null,
}: OrderCollaborationPanelProps) {
  if ((orderId == null) === (leadId == null)) {
    throw new Error("OrderCollaborationPanel requires exactly one of orderId or leadId");
  }
  const isLead = leadId != null;
  const [messages, setMessages] = useState<CollaborationMessage[]>([]);
  const [candidates, setCandidates] = useState<CollaborationMentionCandidate[]>([]);
  const [draft, setDraft] = useState("");
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
      isLead
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
  }, [isLead, leadId, orderId, technicalCardId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  async function sendMessage() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError("");
    const result = isLead
      ? await createLeadCollaborationMessage(leadId!, { body })
      : await createOrderCollaborationMessage(orderId!, {
          body,
          technical_card_id: technicalCardId,
        });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDraft("");
    setMessages((current) => [...current, result.data]);
  }

  const shellClass = embedded
    ? "flex h-full min-h-[28rem] min-w-0 flex-col"
    : "flex min-h-[22rem] min-w-0 flex-col rounded-portal-lg border border-portal-border bg-portal-surface shadow-portal-card";

  return (
    <div className={shellClass} data-order-collaboration-panel>
      <div className="flex items-center justify-between gap-2 border-b border-portal-border px-3.5 py-2.5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-portal-text">{title}</h3>
          <p className="text-[11px] text-slate-500">
            {technicalCardId
              ? `Контекст ТК #${technicalCardId}`
              : isLead
                ? "Внутренний чат по лиду"
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

      <div className={`grid min-h-0 flex-1 ${customerSummary ? "lg:grid-cols-[1fr_14rem]" : ""}`}>
        <div className="flex min-h-0 min-w-0 flex-col">
          {error ? (
            <p className="mx-3.5 mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <div ref={historyRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3.5 py-3">
            {loading ? (
              <p className="text-xs text-slate-500">Загрузка…</p>
            ) : messages.length === 0 ? (
              <p className="text-xs text-slate-500">
                Пока нет сообщений. Напишите коллегам или упомяните @login.
              </p>
            ) : (
              messages.map((message) => (
                <article
                  key={message.id}
                  className="rounded-md border border-slate-100 bg-slate-50/80 px-2.5 py-2"
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
                  <p className="whitespace-pre-wrap text-sm text-slate-800">
                    {highlightMentions(message.body, message.mentions)}
                  </p>
                </article>
              ))
            )}
          </div>

          <div className="relative border-t border-portal-border p-3">
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
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              rows={3}
              placeholder="Сообщение… Используйте @login для упоминания"
              className="w-full resize-none rounded-md border border-slate-200 px-2.5 py-2 text-sm"
              disabled={busy}
            />
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                variant="primary"
                className="h-9 px-3 text-xs"
                disabled={busy || !draft.trim()}
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
    </div>
  );
}
