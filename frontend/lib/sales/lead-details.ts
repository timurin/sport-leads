import "server-only";

import { leads } from "@/lib/demo-data/sales";
import type { LeadActivity, LeadCommercialDetailsData, LeadCustomer, LeadMessage, LeadStatus, LeadTask } from "@/types/sales";

export type LeadSource = string;

export type LeadResponsible = {
  id: string;
  name: string;
};

export type LeadDetails = {
  id: string;
  title: string;
  contactName: string;
  status: LeadStatus;
  statusLabel: string;
  responsible: LeadResponsible | null;
  source: LeadSource | null;
  createdAt: string;
  lastActivityAt: string;
  estimatedAmount: number | null;
  probability: number | null;
  customer: LeadCustomer;
  commercial: LeadCommercialDetailsData;
  activities: LeadActivity[];
  tasks: LeadTask[];
  messages: LeadMessage[];
  taskReferenceAt: string;
};

type ApiLead = {
  id: number;
  status: LeadStatus;
  company_name: string | null;
  contact_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  source: string | null;
  responsible_id: number | null;
  estimated_amount: number | string | null;
  created_at: string;
  updated_at: string;
};

const statusLabels: Record<LeadStatus, string> = {
  new: "Новый",
  contact: "Первичный контакт",
  qualification: "Квалификация",
  proposal: "Предложение",
  waiting: "Ожидание",
  completed: "Завершён",
  won: "Успешно",
  unqualified: "Не квалифицирован",
};

function fromDemoLead(lead: (typeof leads)[number]): LeadDetails {
  const sequence = Number.parseInt(lead.id.replace("lead-", ""), 10) || 1;
  const createdAt = new Date(Date.UTC(2026, 6, Math.max(1, 16 - sequence), 9, 0));
  const messages: LeadMessage[] = lead.messages?.map((message) => ({
    ...message,
    author: message.author ? { ...message.author } : undefined,
    attachments: message.attachments?.map((attachment) => ({ ...attachment })),
  })) ?? [
    {
      id: `${lead.id}-message-website-in`,
      leadId: lead.id,
      channel: "website",
      direction: "incoming",
      text: `Здравствуйте! Интересует заказ для «${lead.clientName}». Подскажите, как получить предварительный расчёт?`,
      senderName: lead.contact,
      sentAt: new Date(createdAt.getTime() + 70 * 60 * 1000).toISOString(),
      status: "read",
      isMock: true,
    },
    {
      id: `${lead.id}-message-website-out`,
      leadId: lead.id,
      channel: "website",
      direction: "outgoing",
      text: `Добрый день, ${lead.contact}! Уточним детали и подготовим предварительный расчёт.`,
      author: { ...lead.responsible },
      recipientName: lead.contact,
      sentAt: new Date(createdAt.getTime() + 85 * 60 * 1000).toISOString(),
      status: "delivered",
      isMock: true,
    },
  ];
  const baseActivities: LeadActivity[] = lead.activities?.map((activity) => ({
    ...activity,
    author: activity.author ? { ...activity.author } : undefined,
    metadata: activity.metadata ? { ...activity.metadata } : undefined,
    attachments: activity.attachments?.map((attachment) => ({ ...attachment })),
    mentionedUserIds: activity.mentionedUserIds ? [...activity.mentionedUserIds] : undefined,
  })) ?? [
    {
      id: `${lead.id}-activity-created`,
      type: "lead_created",
      occurredAt: createdAt.toISOString(),
      title: "Лид создан",
      description: `Лид «${lead.clientName}» добавлен из источника «${lead.source}».`,
      isSystem: true,
    },
    {
      id: `${lead.id}-activity-responsible`,
      type: "responsible_changed",
      occurredAt: new Date(createdAt.getTime() + 30 * 60 * 1000).toISOString(),
      author: { id: lead.responsible.id, name: lead.responsible.name },
      title: "Назначен ответственный",
      description: `${lead.responsible.name} назначен ответственным за лид.`,
      isSystem: true,
    },
    {
      id: `${lead.id}-activity-status`,
      type: "status_changed",
      occurredAt: new Date(createdAt.getTime() + 60 * 60 * 1000).toISOString(),
      author: { id: lead.responsible.id, name: lead.responsible.name },
      title: "Статус лида обновлён",
      description: `Текущий статус: «${statusLabels[lead.status]}».`,
      isSystem: true,
    },
  ];
  const linkedMessageIds = new Set(baseActivities.map((activity) => activity.metadata?.messageId).filter(Boolean));
  const messageActivities: LeadActivity[] = messages
    .filter((message) => !linkedMessageIds.has(message.id))
    .map((message) => ({
      id: `${message.id}-activity`,
      type: message.channel === "email"
        ? message.direction === "incoming" ? "email_received" : "email_sent"
        : message.direction === "incoming" ? "incoming_message" : "outgoing_message",
      occurredAt: message.sentAt,
      author: message.author ? { id: message.author.id, name: message.author.name } : undefined,
      title: message.direction === "incoming" ? "Получено сообщение клиента" : "Отправлено сообщение клиенту",
      description: message.text || "Сообщение содержит вложение.",
      direction: message.direction,
      channel: message.channel,
      metadata: { messageId: message.id },
      attachments: message.attachments?.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        mediaType: attachment.type || "Файл",
      })),
    }));

  return {
    id: lead.id,
    title: lead.clientName,
    contactName: lead.contact,
    status: lead.status,
    statusLabel: statusLabels[lead.status],
    responsible: lead.responsible,
    source: lead.source,
    createdAt: createdAt.toISOString(),
    lastActivityAt: new Date(Date.UTC(2026, 6, 16, 12, sequence)).toISOString(),
    estimatedAmount: lead.estimatedAmount,
    probability: lead.probability ?? null,
    commercial: lead.commercial
      ? { ...lead.commercial }
      : {
        sport: lead.sport as LeadCommercialDetailsData["sport"],
        productCategory: lead.productCategory as LeadCommercialDetailsData["productCategory"],
        needDescription: lead.needDescription,
        estimatedQuantity: lead.quantity,
        desiredReadyDate: lead.desiredDate,
        deliveryCity: lead.city,
        priority: lead.priority,
      },
    activities: [...baseActivities, ...messageActivities],
    tasks: lead.tasks?.map((task) => ({
      ...task,
      assignedTo: { ...task.assignedTo },
      createdBy: { ...task.createdBy },
    })) ?? [],
    messages,
    taskReferenceAt: new Date(Date.UTC(2026, 6, 16, 12, sequence)).toISOString(),
    customer: lead.customer
      ? { ...lead.customer, contacts: lead.customer.contacts.map((contact) => ({ ...contact })) }
      : {
        type: "company",
        organizationName: lead.clientName,
        city: lead.city,
        contacts: [{
          id: `${lead.id}-contact-1`,
          name: lead.contact,
          preferredChannel: "unspecified",
          isPrimary: true,
        }],
      },
  };
}

function fromApiLead(lead: ApiLead): LeadDetails {
  return {
    id: String(lead.id),
    title: lead.company_name ?? lead.contact_name,
    contactName: lead.contact_name,
    status: lead.status,
    statusLabel: statusLabels[lead.status],
    responsible: lead.responsible_id === null
      ? null
      : {
        id: String(lead.responsible_id),
        name: `Сотрудник #${lead.responsible_id}`,
      },
    source: lead.source,
    createdAt: lead.created_at,
    lastActivityAt: lead.updated_at,
    estimatedAmount: lead.estimated_amount === null ? null : Number(lead.estimated_amount),
    probability: null,
    commercial: {
      deliveryCity: lead.city ?? undefined,
    },
    activities: [],
    tasks: [],
    messages: [],
    taskReferenceAt: lead.updated_at,
    customer: {
      type: lead.company_name ? "company" : "person",
      organizationName: lead.company_name ?? undefined,
      city: lead.city ?? undefined,
      contacts: [{
        id: `lead-${lead.id}-contact-1`,
        name: lead.contact_name,
        phone: lead.phone ?? undefined,
        email: lead.email ?? undefined,
        preferredChannel: "unspecified",
        isPrimary: true,
      }],
    },
  };
}

export type LeadApiUpdate = {
  status?: "new" | "contact" | "qualification" | "proposal" | "waiting";
};

export async function updateApiLead(leadId: string, update: LeadApiUpdate): Promise<boolean> {
  const apiUrl = process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/leads/${leadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
    cache: "no-store",
  });

  return response.ok;
}

export async function getLeadDetails(leadId: string): Promise<LeadDetails | null> {
  const demoLead = leads.find((lead) => lead.id === leadId);
  if (demoLead) {
    return fromDemoLead(demoLead);
  }

  if (!/^\d+$/.test(leadId)) {
    return null;
  }

  const apiUrl = process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/leads/${leadId}`, {
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Lead API request failed with status ${response.status}`);
  }

  return fromApiLead(await response.json() as ApiLead);
}
