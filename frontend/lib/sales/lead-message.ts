import type { LeadActivity, LeadContact, LeadMessage, LeadMessageChannel } from "@/types/sales";

export type LeadMessageFilter = "all" | "telegram" | "email" | "whatsapp" | "vk";

export const leadMessageChannelLabels: Record<LeadMessageChannel, string> = {
  phone: "Телефон",
  email: "Email",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  vk: "VK",
  website: "Форма сайта",
  internal: "Внутренний",
};

export const leadMessageStatusLabels = {
  draft: "Черновик",
  sending: "Отправляется",
  sent: "Отправлено",
  delivered: "Доставлено",
  read: "Прочитано",
  failed: "Ошибка",
} as const;

export const sendableLeadMessageChannels: ReadonlyArray<LeadMessageChannel> = ["email", "telegram", "whatsapp", "vk"];

export function sortLeadMessages(messages: ReadonlyArray<LeadMessage>) {
  return messages
    .map((message, index) => ({ message, index }))
    .sort((left, right) => Date.parse(left.message.sentAt) - Date.parse(right.message.sentAt) || left.index - right.index)
    .map(({ message }) => message);
}

export function filterLeadMessages(messages: ReadonlyArray<LeadMessage>, filter: LeadMessageFilter) {
  return sortLeadMessages(messages).filter((message) => filter === "all" || message.channel === filter);
}

export function filterLeadMessagesByChannel(
  messages: ReadonlyArray<LeadMessage>,
  channel: LeadMessageChannel,
) {
  return sortLeadMessages(messages).filter((message) => message.channel === channel);
}

export type LeadChannelThreadItem = {
  id: string;
  occurredAt: string;
  direction?: LeadMessage["direction"];
  authorName?: string;
  recipientName?: string;
  text?: string;
  statusLabel?: string;
  attachments?: Array<{ id: string; name: string; sizeLabel?: string }>;
};

export function buildLeadChannelThread(
  channel: LeadMessageChannel,
  messages: ReadonlyArray<LeadMessage>,
  activities: ReadonlyArray<LeadActivity> = [],
): LeadChannelThreadItem[] {
  const fromMessages = filterLeadMessagesByChannel(messages, channel).map((message) => ({
    id: `message-${message.id}`,
    occurredAt: message.sentAt,
    direction: message.direction,
    authorName: message.author?.name ?? message.senderName,
    recipientName: message.recipientName,
    text: message.text,
    statusLabel: message.status ? leadMessageStatusLabels[message.status] : undefined,
    attachments: message.attachments?.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      sizeLabel: formatAttachmentSize(attachment.size),
    })),
  }));
  const coveredIds = new Set(fromMessages.map((item) => item.id));
  for (const message of messages) {
    if (message.channel === channel) coveredIds.add(message.id);
  }
  const fromActivities = activities
    .filter((activity) => {
      if (activity.channel !== channel || activity.isSystem) return false;
      if (coveredIds.has(activity.id)) return false;
      const messageId = activity.metadata?.messageId;
      if (messageId !== undefined && (coveredIds.has(String(messageId)) || coveredIds.has(`message-${messageId}`))) {
        return false;
      }
      return true;
    })
    .map((activity) => ({
      id: activity.id,
      occurredAt: activity.occurredAt,
      direction: activity.direction,
      authorName: activity.author?.name,
      text: activity.description,
      attachments: activity.attachments?.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        sizeLabel: attachment.sizeLabel,
      })),
    }));
  return [...fromMessages, ...fromActivities]
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftTime = Date.parse(left.item.occurredAt);
      const rightTime = Date.parse(right.item.occurredAt);
      const safeLeft = Number.isNaN(leftTime) ? 0 : leftTime;
      const safeRight = Number.isNaN(rightTime) ? 0 : rightTime;
      return safeRight - safeLeft || left.index - right.index;
    })
    .map(({ item }) => item);
}

export function getLeadMessageDestination(channel: LeadMessageChannel, contact?: LeadContact, website?: string) {
  if (channel === "email") return contact?.email?.trim();
  if (channel === "phone" || channel === "whatsapp") return contact?.phone?.trim();
  if (channel === "telegram" || channel === "vk") {
    return contact?.preferredChannel === channel ? contact.messenger?.trim() : undefined;
  }
  if (channel === "website") return website?.trim();
  return undefined;
}

export function canSendLeadMessage(channel: LeadMessageChannel, destination?: string) {
  return sendableLeadMessageChannels.includes(channel) && Boolean(destination);
}

export function formatAttachmentSize(size?: number) {
  if (size === undefined) return undefined;
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1).replace(".0", "")} МБ`;
}

const messageDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});

export function formatLeadMessageDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Дата неизвестна" : messageDateFormatter.format(date);
}
