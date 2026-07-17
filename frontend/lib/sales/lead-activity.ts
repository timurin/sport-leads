import type { LeadActivity, UserSummary } from "@/types/sales";

export type LeadActivityFilter = "all" | "comments" | "messages" | "tasks" | "files";

const messageTypes = new Set<LeadActivity["type"]>([
  "incoming_call",
  "outgoing_call",
  "incoming_message",
  "outgoing_message",
  "email_received",
  "email_sent",
]);
const taskTypes = new Set<LeadActivity["type"]>(["task_created", "task_updated", "task_completed"]);

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Moscow",
});
const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Moscow",
});

export function sortLeadActivities(activities: ReadonlyArray<LeadActivity>) {
  return activities
    .map((activity, index) => ({ activity, index }))
    .sort((left, right) => {
      const leftTime = Date.parse(left.activity.occurredAt);
      const rightTime = Date.parse(right.activity.occurredAt);
      const safeLeftTime = Number.isNaN(leftTime) ? Number.NEGATIVE_INFINITY : leftTime;
      const safeRightTime = Number.isNaN(rightTime) ? Number.NEGATIVE_INFINITY : rightTime;
      return safeRightTime - safeLeftTime || left.index - right.index;
    })
    .map(({ activity }) => activity);
}

export function filterLeadActivities(activities: ReadonlyArray<LeadActivity>, filter: LeadActivityFilter) {
  if (filter === "all") {
    return [...activities];
  }
  if (filter === "comments") {
    return activities.filter((activity) => activity.type === "comment_added");
  }
  if (filter === "messages") {
    return activities.filter((activity) => messageTypes.has(activity.type));
  }
  if (filter === "tasks") {
    return activities.filter((activity) => taskTypes.has(activity.type));
  }
  return activities.filter((activity) => activity.type === "file_attached" || Boolean(activity.attachments?.length));
}

export function formatActivityDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Дата не указана"
    : `${dateFormatter.format(date).replace(/\s*г\.$/, "")}, ${timeFormatter.format(date)}`;
}

export function isInternalNote(activity: LeadActivity) {
  return activity.type === "comment_added";
}

export function getNotePermissions(activity: LeadActivity, currentUserId: string) {
  const isNote = isInternalNote(activity);
  const isOwner = isNote && activity.author?.id === currentUserId;
  return {
    canEdit: isOwner,
    canDelete: isOwner,
    canPin: isNote,
  };
}

export function insertMention(text: string, user: Pick<UserSummary, "name">) {
  const mention = `@${user.name}`;
  if (text.includes(mention)) {
    return text;
  }
  const trimmedEnd = text.trimEnd();
  return trimmedEnd ? `${trimmedEnd} ${mention} ` : `${mention} `;
}

export function getMentionedUserIds(
  text: string,
  users: ReadonlyArray<Pick<UserSummary, "id" | "name">>,
  selectedIds: ReadonlyArray<string> = [],
) {
  const selected = new Set(selectedIds);
  for (const user of users) {
    if (text.includes(`@${user.name}`)) {
      selected.add(user.id);
    }
  }
  return [...selected].filter((id) => users.some((user) => user.id === id));
}
