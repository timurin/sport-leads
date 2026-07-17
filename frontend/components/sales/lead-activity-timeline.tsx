"use client";

import {
  BriefcaseBusiness,
  CheckCircle2,
  Ellipsis,
  FileText,
  Mail,
  MessageCircle,
  MessageSquareText,
  Paperclip,
  Pin,
  PinOff,
  Phone,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { memo, useMemo, useRef, useState } from "react";

import { LeadMentionPicker, LeadNoteDeleteDialog, LeadNoteEditDialog } from "@/components/sales/lead-note-dialog";
import { Button } from "@/components/ui/button";
import {
  filterLeadActivities,
  formatActivityDate,
  getMentionedUserIds,
  getNotePermissions,
  isInternalNote,
  sortLeadActivities,
  type LeadActivityFilter,
} from "@/lib/sales/lead-activity";
import type { LeadActivity, LeadActivityChannel, LeadActivityType, UserSummary } from "@/types/sales";

const filterOptions: ReadonlyArray<{ id: LeadActivityFilter; label: string }> = [
  { id: "all", label: "Все события" },
  { id: "comments", label: "Комментарии" },
  { id: "messages", label: "Сообщения" },
  { id: "tasks", label: "Задачи" },
  { id: "files", label: "Файлы" },
];

const channelLabels: Record<LeadActivityChannel, string> = {
  phone: "Телефон",
  email: "Email",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  vk: "VK",
  website: "Форма сайта",
  internal: "Внутренний",
};

function getTypePresentation(type: LeadActivityType) {
  if (type === "comment_added") {
    return { Icon: MessageSquareText, label: "Внутренняя заметка", classes: "bg-blue-50 text-blue-700" };
  }
  if (type === "incoming_call" || type === "outgoing_call") {
    return { Icon: Phone, label: "Звонок", classes: "bg-emerald-50 text-emerald-700" };
  }
  if (type === "incoming_message" || type === "outgoing_message") {
    return { Icon: MessageCircle, label: "Сообщение", classes: "bg-cyan-50 text-cyan-700" };
  }
  if (type === "email_received" || type === "email_sent") {
    return { Icon: Mail, label: "Письмо", classes: "bg-violet-50 text-violet-700" };
  }
  if (type === "task_created" || type === "task_updated" || type === "task_completed") {
    return { Icon: type === "task_completed" ? CheckCircle2 : BriefcaseBusiness, label: "Задача", classes: "bg-amber-50 text-amber-800" };
  }
  if (type === "file_attached") {
    return { Icon: Paperclip, label: "Файл", classes: "bg-orange-50 text-orange-700" };
  }
  if (type === "customer_updated") {
    return { Icon: UserRound, label: "Данные клиента", classes: "bg-sky-50 text-sky-700" };
  }
  if (type === "commercial_updated" || type === "order_created" || type === "deal_created") {
    return { Icon: BriefcaseBusiness, label: "Коммерческое событие", classes: "bg-indigo-50 text-indigo-700" };
  }
  return { Icon: RefreshCw, label: "Системное событие", classes: "bg-slate-100 text-slate-700" };
}

function MentionText({ text, mentionedUsers }: { text: string; mentionedUsers: UserSummary[] }) {
  if (!mentionedUsers.length) {
    return <>{text}</>;
  }
  const names = mentionedUsers.map((user) => `@${user.name}`).sort((left, right) => right.length - left.length);
  const escapedNames = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escapedNames.join("|")})`, "g"));
  return <>{parts.map((part, index) => names.includes(part)
    ? <span key={`${part}-${index}`} className="rounded bg-blue-50 px-1 font-medium text-blue-800">{part}<span className="sr-only"> — упоминание сотрудника</span></span>
    : <span key={index}>{part}</span>)}</>;
}

const ActivityItem = memo(function ActivityItem({
  activity,
  currentUserId,
  managers,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  activity: LeadActivity;
  currentUserId: string;
  managers: UserSummary[];
  onEdit: (note: LeadActivity, trigger: HTMLElement) => void;
  onDelete: (note: LeadActivity, trigger: HTMLElement) => void;
  onTogglePin: (noteId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { Icon, label, classes } = getTypePresentation(activity.type);
  const permissions = getNotePermissions(activity, currentUserId);
  const mentionedUsers = managers.filter((manager) => activity.mentionedUserIds?.includes(manager.id));
  return (
    <article className="group relative flex min-w-0 gap-3 pb-5 last:pb-0" aria-label={`${label}: ${activity.title}`}>
      <div className="absolute bottom-0 left-4 top-8 w-px bg-slate-200 group-last:hidden" aria-hidden="true" />
      <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${classes}`} aria-hidden="true">
        <Icon size={15} />
      </span>
      <div className={`min-w-0 flex-1 border-b border-slate-100 pb-5 group-last:border-b-0 ${activity.isSystem ? "text-slate-700" : "text-slate-900"}`}>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">{label}</span>
              {activity.channel ? <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600">{channelLabels[activity.channel]}</span> : null}
              {activity.direction ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{activity.direction === "incoming" ? "Входящее" : "Исходящее"}</span> : null}
              {activity.isSystem ? <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">Системное</span> : null}
              {activity.isPinned ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"><Pin size={11} /> Закреплено</span> : null}
              {activity.updatedAt ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Изменено</span> : null}
            </div>
            <h3 className="mt-1 text-sm font-semibold text-slate-950">{activity.title}</h3>
          </div>
          <div className="flex shrink-0 items-start gap-2">
            <div className="text-right">
              <time dateTime={activity.occurredAt} className="block text-xs text-slate-500">{formatActivityDate(activity.occurredAt)}</time>
              {activity.updatedAt ? <time dateTime={activity.updatedAt} className="mt-1 block text-xs text-slate-400">Изменено {formatActivityDate(activity.updatedAt)}</time> : null}
            </div>
            {permissions.canPin ? (
              <div className="relative">
                <button ref={menuButtonRef} type="button" aria-label="Действия с заметкой" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((current) => !current)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Ellipsis size={17} /></button>
                {menuOpen ? (
                  <div className="absolute right-0 z-30 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-xl" role="menu">
                    <button type="button" role="menuitem" onClick={() => { onTogglePin(activity.id); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">{activity.isPinned ? <PinOff size={14} /> : <Pin size={14} />}{activity.isPinned ? "Открепить" : "Закрепить"}</button>
                    {permissions.canEdit ? <button type="button" role="menuitem" onClick={(event) => { onEdit(activity, menuButtonRef.current ?? event.currentTarget); setMenuOpen(false); }} className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Редактировать</button> : null}
                    {permissions.canDelete ? <button type="button" role="menuitem" onClick={(event) => { onDelete(activity, menuButtonRef.current ?? event.currentTarget); setMenuOpen(false); }} className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">Удалить</button> : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-500">Автор: <span className="font-medium text-slate-700">{activity.author?.name ?? (activity.isSystem ? "Система" : "Не указан")}</span></p>
        {activity.description ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{isInternalNote(activity) ? <MentionText text={activity.description} mentionedUsers={mentionedUsers} /> : activity.description}</p> : null}
        {mentionedUsers.length ? <p className="mt-2 text-xs text-slate-500">Упомянуты: {mentionedUsers.map((user) => user.name).join(", ")}</p> : null}
        {activity.metadata ? (
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            {Object.entries(activity.metadata).map(([key, value]) => (
              <div key={key} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <dt className="text-xs text-slate-500">{key}</dt>
                <dd className="mt-0.5 break-words font-medium text-slate-700">{String(value)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {activity.attachments?.length ? (
          <div className="mt-3 space-y-2" aria-label="Вложения">
            {activity.attachments.map((attachment) => (
              <div key={attachment.id} className="flex min-w-0 flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
                <FileText size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="[overflow-wrap:anywhere] text-sm font-medium text-slate-800">{attachment.name}</p>
                  <p className="text-xs text-slate-500">{attachment.mediaType}{attachment.sizeLabel ? ` · ${attachment.sizeLabel}` : ""}</p>
                </div>
                <Button type="button" disabled title="Просмотр будет доступен позже" className="h-9 shrink-0 px-3">Просмотр позже</Button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
});

type NoteDialogState =
  | { kind: "edit"; note: LeadActivity }
  | { kind: "delete"; note: LeadActivity }
  | null;

export function LeadActivityTimeline({
  activities,
  currentUser,
  managers,
  onAddComment,
  onEditNote,
  onDeleteNote,
  onTogglePin,
  embedded = false,
  compact = false,
  mode = "history",
}: {
  activities: LeadActivity[];
  currentUser: UserSummary;
  managers: UserSummary[];
  onAddComment: (text: string, mentionedUserIds: string[]) => void;
  onEditNote: (noteId: string, text: string, mentionedUserIds: string[]) => void;
  onDeleteNote: (noteId: string) => void;
  onTogglePin: (noteId: string) => void;
  embedded?: boolean;
  compact?: boolean;
  mode?: "history" | "notes";
}) {
  const [activeFilter, setActiveFilter] = useState<LeadActivityFilter>("all");
  const [comment, setComment] = useState("");
  const [selectedMentionIds, setSelectedMentionIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<NoteDialogState>(null);
  const dialogTriggerRef = useRef<HTMLElement | null>(null);
  const commentFieldRef = useRef<HTMLTextAreaElement>(null);
  const sortedActivities = useMemo(() => sortLeadActivities(activities), [activities]);
  const visibleActivities = useMemo(
    () => sortedActivities.filter((activity) => mode === "notes" ? isInternalNote(activity) && !activity.isPinned : !isInternalNote(activity)),
    [mode, sortedActivities],
  );
  const pinnedNotes = useMemo(
    () => sortedActivities.filter((activity) => isInternalNote(activity) && activity.isPinned),
    [sortedActivities],
  );
  const filteredActivities = useMemo(
    () => mode === "notes" ? visibleActivities : filterLeadActivities(visibleActivities, activeFilter),
    [activeFilter, mode, visibleActivities],
  );
  const counts = useMemo(() => Object.fromEntries(
    filterOptions.map((option) => [option.id, filterLeadActivities(visibleActivities, option.id).length]),
  ) as Record<LeadActivityFilter, number>, [visibleActivities]);
  const historyFilterOptions = filterOptions.filter((option) => option.id !== "comments");
  const compactLimit = mode === "notes" ? 3 : 5;
  const primaryActivities = compact ? filteredActivities.slice(0, compactLimit) : filteredActivities;
  const remainingActivities = compact ? filteredActivities.slice(compactLimit) : [];

  function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = comment.trim();
    if (!text) {
      setError("Введите текст комментария.");
      return;
    }
    onAddComment(text, getMentionedUserIds(text, managers));
    setComment("");
    setSelectedMentionIds([]);
    setError("");
    setActiveFilter("all");
  }

  function openDialog(nextDialog: Exclude<NoteDialogState, null>, trigger: HTMLElement) {
    dialogTriggerRef.current = trigger;
    setDialog(nextDialog);
  }

  function closeDialog() {
    setDialog(null);
    window.requestAnimationFrame(() => {
      const trigger = dialogTriggerRef.current;
      if (trigger?.isConnected) {
        trigger.focus();
      } else {
        commentFieldRef.current?.focus();
      }
    });
  }

  return (
    <section className={embedded ? `min-w-0 ${compact ? "p-3" : "p-4 sm:p-5"}` : "min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"}>
      <div>
        <h2 className={`${compact ? "text-sm font-bold" : "text-base font-semibold"} text-slate-950`}>{compact ? (mode === "notes" ? "F) Комментарии менеджера" : "D) История активности") : (mode === "notes" ? "Заметки" : "История лида")}</h2>
        {!compact ? <p className="mt-1 text-sm text-slate-500">{mode === "notes" ? "Внутренние комментарии, закрепления и упоминания команды." : "События и коммуникации в единой хронологии."}</p> : null}
      </div>

      {mode === "notes" ? <details open={!compact} className="mt-3 border-t border-slate-200 pt-3">
        <summary className={`${compact ? "cursor-pointer text-xs font-semibold text-blue-700" : "sr-only"}`}>Добавить комментарий</summary>
      <form onSubmit={submitComment} className={`${compact ? "mt-3" : "mt-4"} bg-slate-50 p-3.5`}>
        <label htmlFor="lead-internal-comment" className="text-sm font-semibold text-slate-800">Добавить внутренний комментарий</label>
        <textarea
          ref={commentFieldRef}
          id="lead-internal-comment"
          rows={3}
          maxLength={3000}
          value={comment}
          onChange={(event) => { setComment(event.target.value); setError(""); }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "lead-internal-comment-error" : "lead-internal-comment-count"}
          className="mt-2 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder="Заметка видна только сотрудникам"
        />
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {error ? <p id="lead-internal-comment-error" className="text-sm text-red-700" role="alert">{error}</p> : null}
            <p id="lead-internal-comment-count" className="text-xs text-slate-500">{comment.length} / 3000</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <LeadMentionPicker text={comment} selectedIds={selectedMentionIds} managers={managers} onChange={(text, ids) => { setComment(text); setSelectedMentionIds(ids); }} />
            <Button type="submit" variant="primary" className="w-full sm:w-auto">Добавить заметку</Button>
          </div>
        </div>
      </form></details> : null}

      {mode === "notes" && pinnedNotes.length ? (
        <section className="mt-4 border-y border-amber-200 bg-amber-50/50 p-3.5" aria-labelledby="pinned-lead-notes-title">
          <h3 id="pinned-lead-notes-title" className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Pin size={16} className="text-amber-700" /> Закреплённые заметки</h3>
          <div className="mt-3 grid gap-3">
            {pinnedNotes.map((note) => {
              const mentionedUsers = managers.filter((manager) => note.mentionedUserIds?.includes(manager.id));
              return (
                <article key={note.id} className="min-w-0 border-l-2 border-amber-300 bg-white/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-medium text-slate-500">{note.author?.name ?? "Автор не указан"} · {formatActivityDate(note.occurredAt)}</p>
                    <button type="button" onClick={() => onTogglePin(note.id)} aria-label="Открепить заметку" className="shrink-0 rounded-lg p-1.5 text-amber-700 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"><PinOff size={15} /></button>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700"><MentionText text={note.description ?? ""} mentionedUsers={mentionedUsers} /></p>
                  {mentionedUsers.length ? <p className="mt-2 text-xs text-slate-500">Упомянуты: {mentionedUsers.map((user) => user.name).join(", ")}</p> : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {mode === "history" ? <div className="mt-4 overflow-x-auto overflow-y-hidden pb-1" role="tablist" aria-label="Фильтр истории лида">
        <div className="flex min-w-max gap-2">
          {historyFilterOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={activeFilter === option.id}
              onClick={() => setActiveFilter(option.id)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${activeFilter === option.id ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {option.label} <span className="ml-1 text-xs">{counts[option.id]}</span>
            </button>
          ))}
        </div>
      </div> : null}

      <div className="mt-4 min-w-0" role="feed" aria-label={mode === "notes" ? "Список заметок" : "События лида"}>
        {filteredActivities.length ? primaryActivities.map((activity) => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            currentUserId={currentUser.id}
            managers={managers}
            onEdit={(note, trigger) => openDialog({ kind: "edit", note }, trigger)}
            onDelete={(note, trigger) => openDialog({ kind: "delete", note }, trigger)}
            onTogglePin={onTogglePin}
          />
        )) : mode === "notes" && pinnedNotes.length ? null : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <p className="text-sm font-medium text-slate-700">{mode === "notes" ? "Заметок пока нет" : "История пока пуста"}</p>
            <p className="mt-1 text-sm leading-6 text-slate-500">{mode === "notes" ? "Добавьте внутреннюю заметку для команды." : "События и коммуникации появятся здесь."}</p>
          </div>
        )}
        {remainingActivities.length ? (
          <details className="mt-3 border-t border-slate-200 pt-3">
            <summary className="cursor-pointer text-xs font-semibold text-blue-700">{mode === "notes" ? `Показать все комментарии (${filteredActivities.length})` : `Показать всю историю (${filteredActivities.length})`}</summary>
            <div className="mt-4">
              {remainingActivities.map((activity) => (
                <ActivityItem
                  key={activity.id}
                  activity={activity}
                  currentUserId={currentUser.id}
                  managers={managers}
                  onEdit={(note, trigger) => openDialog({ kind: "edit", note }, trigger)}
                  onDelete={(note, trigger) => openDialog({ kind: "delete", note }, trigger)}
                  onTogglePin={onTogglePin}
                />
              ))}
            </div>
          </details>
        ) : null}
      </div>

      {dialog?.kind === "edit" ? (
        <LeadNoteEditDialog
          note={dialog.note}
          managers={managers}
          onClose={closeDialog}
          onSave={(text, mentionedUserIds) => { onEditNote(dialog.note.id, text, mentionedUserIds); closeDialog(); }}
        />
      ) : null}
      {dialog?.kind === "delete" ? (
        <LeadNoteDeleteDialog note={dialog.note} onClose={closeDialog} onConfirm={() => { onDeleteNote(dialog.note.id); closeDialog(); }} />
      ) : null}
    </section>
  );
}
