import type { LeadContact, LeadMessage, LeadMessageChannel } from "@/types/sales";

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
