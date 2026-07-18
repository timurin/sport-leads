import "server-only";

import { leads } from "@/lib/demo-data/sales";
import { fromApiLeadCommercial, type ApiLeadCommercialFields } from "@/lib/sales/lead-commercial-api";
import { fromApiLeadContact, type ApiLeadContact } from "@/lib/sales/lead-contact-api";
import { fromApiLeadCustomer, type ApiLeadCustomerFields } from "@/lib/sales/lead-customer-api";
import { findBackendReasonId, type ApiLeadRejectionReason } from "@/lib/sales/lead-rejection";
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
  dataOrigin: "api" | "demo";
};

export type ApiLead = ApiLeadCommercialFields & ApiLeadCustomerFields & {
  id: number;
  status: LeadStatus;
  contact_name: string;
  phone: string | null;
  email: string | null;
  responsible_id: number | null;
  created_at: string;
  updated_at: string;
  contacts: ApiLeadContact[];
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
    dataOrigin: "demo",
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
  const persistedCommercial = fromApiLeadCommercial(lead);
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
    source: persistedCommercial.source,
    createdAt: lead.created_at,
    lastActivityAt: lead.updated_at,
    estimatedAmount: persistedCommercial.estimatedAmount,
    probability: null,
    commercial: persistedCommercial.commercial,
    activities: [],
    tasks: [],
    messages: [],
    taskReferenceAt: lead.updated_at,
    dataOrigin: "api",
    customer: {
      ...fromApiLeadCustomer(lead),
      contacts: lead.contacts.map(fromApiLeadContact),
    },
  };
}

export type LeadApiUpdate = {
  status?: "new" | "contact" | "qualification" | "proposal" | "waiting";
  source?: string | null;
  sport?: string | null;
  product_category?: string | null;
  need_description?: string | null;
  estimated_quantity?: number | null;
  estimated_amount?: number | null;
  desired_date?: string | null;
  city?: string | null;
  customer_type?: "person" | "sole_proprietor" | "company" | null;
  company_name?: string | null;
  tax_id?: string | null;
  website?: string | null;
  region?: string | null;
  address?: string | null;
  customer_comment?: string | null;
};

export type LeadApiUpdateResult =
  | { ok: true; lead: ApiLead }
  | { ok: false; status: number; message: string };

export async function updateApiLead(leadId: string, update: LeadApiUpdate): Promise<LeadApiUpdateResult> {
  const apiUrl = process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/leads/${leadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Backend отклонил изменение (${response.status}).`;
    try {
      const body = await response.json() as { detail?: string | Array<{ msg?: string }> };
      if (typeof body.detail === "string") {
        message = body.detail;
      } else if (Array.isArray(body.detail)) {
        message = body.detail.map((item) => item.msg).filter(Boolean).join(" ") || message;
      }
    } catch {
      // Use the stable status-based message for empty or non-JSON responses.
    }
    return { ok: false, status: response.status, message };
  }
  return { ok: true, lead: await response.json() as ApiLead };
}

export type LeadApiConversion = {
  lead: ApiLead;
  order: {
    id: number;
    number: string;
    product_category: string | null;
    sport: string | null;
    quantity: number | null;
    amount: number | string | null;
    desired_date: string | null;
  };
};

export type LeadApiConversionResult =
  | { ok: true; conversion: LeadApiConversion }
  | { ok: false; status: number; message: string };

export async function convertApiLead(
  leadId: string,
  payload: {
    title: string;
    description: string;
    product_category: string;
    sport: string;
    quantity: number;
    amount: number;
    desired_date: string;
  },
): Promise<LeadApiConversionResult> {
  const apiUrl = process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/leads/${leadId}/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Backend отклонил конвертацию (${response.status}).`;
    try {
      const body = await response.json() as { detail?: string | Array<{ msg?: string }> };
      if (typeof body.detail === "string") {
        message = body.detail;
      } else if (Array.isArray(body.detail)) {
        message = body.detail.map((item) => item.msg).filter(Boolean).join(" ") || message;
      }
    } catch {
      // Use the stable status-based message for empty or non-JSON responses.
    }
    return { ok: false, status: response.status, message };
  }

  return { ok: true, conversion: await response.json() as LeadApiConversion };
}

export type LeadApiRejectionResult =
  | { ok: true; lead: ApiLead }
  | { ok: false; status: number; message: string };

export async function rejectApiLead(
  leadId: string,
  reasonCode: string,
  comment: string,
): Promise<LeadApiRejectionResult> {
  const apiUrl = process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000";
  const baseUrl = apiUrl.replace(/\/$/, "");
  const reasonsResponse = await fetch(`${baseUrl}/lead-rejection-reasons?is_active=true`, {
    cache: "no-store",
  });

  if (!reasonsResponse.ok) {
    return {
      ok: false,
      status: reasonsResponse.status,
      message: `Backend отклонил загрузку причин отказа (${reasonsResponse.status}).`,
    };
  }

  const reasons = await reasonsResponse.json() as ApiLeadRejectionReason[];
  const reasonId = findBackendReasonId(reasonCode, reasons);
  if (reasonId === null) {
    return { ok: false, status: 422, message: "Выбранная причина отказа недоступна в backend." };
  }

  const response = await fetch(`${baseUrl}/leads/${leadId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rejection_reason_id: reasonId,
      comment: comment || null,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Backend отклонил отказ лида (${response.status}).`;
    try {
      const body = await response.json() as { detail?: string | Array<{ msg?: string }> };
      if (typeof body.detail === "string") {
        message = body.detail;
      } else if (Array.isArray(body.detail)) {
        message = body.detail.map((item) => item.msg).filter(Boolean).join(" ") || message;
      }
    } catch {
      // Use the stable status-based message for empty or non-JSON responses.
    }
    return { ok: false, status: response.status, message };
  }

  return { ok: true, lead: await response.json() as ApiLead };
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
