import type { LeadActivity, LeadMessage, LeadMessageAttachment, LeadMessageChannel, UserSummary } from "@/types/sales";

export type ApiLeadMessageAttachment = {
  id: string;
  name: string;
  type?: string | null;
  size?: number | null;
};

export type ApiLeadMessage = {
  id: number;
  lead_id: number;
  channel: string;
  direction: string;
  text: string;
  status: string;
  author_id: number | null;
  author_name: string | null;
  sender_name: string | null;
  recipient_name: string | null;
  external_id: string | null;
  attachments: ApiLeadMessageAttachment[];
  is_mock: boolean;
  sent_at: string;
  created_at: string;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function authorSummary(message: ApiLeadMessage): UserSummary | undefined {
  if (message.author_id === null) return undefined;
  const name = message.author_name ?? `Сотрудник #${message.author_id}`;
  return { id: String(message.author_id), name, initials: initialsFromName(name) };
}

function mapAttachments(items: ApiLeadMessageAttachment[]): LeadMessageAttachment[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    type: item.type ?? undefined,
    size: item.size ?? undefined,
  }));
}

export function fromApiLeadMessage(message: ApiLeadMessage): LeadMessage {
  return {
    id: String(message.id),
    leadId: String(message.lead_id),
    channel: message.channel as LeadMessageChannel,
    direction: message.direction === "incoming" ? "incoming" : "outgoing",
    text: message.text,
    author: authorSummary(message),
    senderName: message.sender_name ?? undefined,
    recipientName: message.recipient_name ?? undefined,
    sentAt: message.sent_at,
    status: (message.status as LeadMessage["status"]) ?? "sent",
    externalId: message.external_id ?? undefined,
    attachments: mapAttachments(message.attachments),
    isMock: message.is_mock,
  };
}

export function leadMessageToActivity(message: LeadMessage): LeadActivity {
  const isEmail = message.channel === "email";
  const isIncoming = message.direction === "incoming";
  return {
    id: `message-${message.id}`,
    type: isEmail
      ? (isIncoming ? "email_received" : "email_sent")
      : (isIncoming ? "incoming_message" : "outgoing_message"),
    occurredAt: message.sentAt,
    author: message.author,
    title: isEmail
      ? (isIncoming ? "Получено письмо от клиента" : "Отправлено письмо клиенту")
      : (isIncoming ? "Входящее сообщение клиента" : "Отправлено сообщение клиенту"),
    description: message.text || (message.attachments?.length ? "Сообщение содержит вложение." : undefined),
    direction: message.direction,
    channel: message.channel,
    metadata: { messageId: message.id },
    attachments: message.attachments?.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      mediaType: attachment.type || "Файл",
      sizeLabel: attachment.size !== undefined ? `${attachment.size}` : undefined,
    })),
    isSystem: false,
  };
}
