import type { LeadActivity, UserSummary } from "@/types/sales";

export type LeadActivityFilter = "all" | "comments" | "messages" | "tasks" | "files" | "system";

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
  if (filter === "system") {
    return activities.filter((activity) => Boolean(activity.isSystem));
  }
  return activities.filter((activity) => activity.type === "file_attached" || Boolean(activity.attachments?.length));
}

export type LeadActivityChannelFilter = "all" | NonNullable<LeadActivity["channel"]>;

export function filterLeadActivitiesByChannel(
  activities: ReadonlyArray<LeadActivity>,
  filter: LeadActivityChannelFilter,
) {
  if (filter === "all") {
    return [...activities];
  }
  return activities.filter((activity) => activity.channel === filter);
}

export function activityAllowsReply(activity: LeadActivity) {
  if (activity.channel === "internal") {
    return true;
  }
  return messageTypes.has(activity.type);
}

export function activityIsTaskEvent(activity: LeadActivity) {
  return taskTypes.has(activity.type);
}

export function activityIsSystemEvent(activity: LeadActivity) {
  return Boolean(activity.isSystem);
}

export function activityChannelForThread(activity: LeadActivity): NonNullable<LeadActivity["channel"]> | null {
  if (!activity.channel || activity.isSystem) {
    return null;
  }
  if (taskTypes.has(activity.type) || activity.type === "file_attached" || activity.type === "comment_added") {
    return null;
  }
  return activity.channel;
}

export function activityOpensInEventModal(activity: LeadActivity) {
  return !activityIsSystemEvent(activity);
}

export function collaborationMessageToActivity(message: {
  id: number;
  created_at: string;
  author_platform_user_id: number;
  author_login: string;
  author_display_name: string;
  body: string;
}): LeadActivity {
  return {
    id: `collab-${message.id}`,
    type: "outgoing_message",
    occurredAt: message.created_at,
    author: {
      id: String(message.author_platform_user_id),
      name: message.author_display_name || message.author_login,
    },
    title: "Внутреннее сообщение",
    description: message.body,
    direction: "outgoing",
    channel: "internal",
    metadata: { collaborationMessageId: message.id, source: "collaboration" },
  };
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

export function getNotePermissions(
  activity: LeadActivity,
  currentUserId: string,
  options: { persistAll?: boolean } = {},
) {
  const isNote = isInternalNote(activity);
  if (options.persistAll && isNote) {
    return { canEdit: true, canDelete: true, canPin: true };
  }
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
