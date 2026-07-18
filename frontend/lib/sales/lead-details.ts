import "server-only";

import { leads } from "@/lib/demo-data/sales";
import { fromApiLeadCommercial, type ApiLeadCommercialFields } from "@/lib/sales/lead-commercial-api";
import { fromApiLeadContact, type ApiLeadContact } from "@/lib/sales/lead-contact-api";
import { fromApiLeadCustomer, type ApiLeadCustomerFields } from "@/lib/sales/lead-customer-api";
import { resolveLeadDetailStage } from "@/lib/sales/lead-detail-stage";
import { findBackendReasonId, type ApiLeadRejectionReason } from "@/lib/sales/lead-rejection";
import { fromApiLeadEvent, type ApiLeadEvent } from "@/lib/sales/lead-history";
import type { LeadActivity, LeadCommercialDetailsData, LeadCustomer, LeadMessage, LeadResult, LeadStatus, LeadTask } from "@/types/sales";

export type LeadSource = string;

export type LeadResponsible = {
  id: string;
  name: string;
};

export type LeadDetails = {
  id: string;
  title: string;
  contactName: string;
  status: string;
  stageId?: string;
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
  result?: LeadResult;
  completedAt?: string;
  completedBy?: LeadResponsible;
  convertedOrderId?: string;
  convertedOrderNumber?: string;
  rejectionReason?: string;
  rejectionComment?: string;
};

export type ApiLead = ApiLeadCommercialFields & ApiLeadCustomerFields & {
  id: number;
  status: string;
  contact_name: string;
  phone: string | null;
  email: string | null;
  responsible_id: number | null;
  created_at: string;
  updated_at: string;
  contacts: ApiLeadContact[];
  result: LeadResult | null;
  completed_at: string | null;
  completed_by_id: number | null;
  converted_order_id: number | null;
  rejection_reason_id: number | null;
  rejection_comment: string | null;
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

  const stageState = resolveLeadDetailStage(lead.status);
  return {
    id: lead.id,
    title: lead.clientName,
    contactName: lead.contact,
    ...stageState,
    statusLabel: statusLabels[lead.status as LeadStatus] ?? lead.status,
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

function fromApiLead(lead: ApiLead, activities: LeadActivity[]): LeadDetails {
  const persistedCommercial = fromApiLeadCommercial(lead);
  const stageState = resolveLeadDetailStage(lead.status);
  return {
    id: String(lead.id),
    title: lead.company_name ?? lead.contact_name,
    contactName: lead.contact_name,
    ...stageState,
    statusLabel: statusLabels[lead.status as LeadStatus] ?? lead.status,
    responsible: lead.responsible_id === null
      ? null
      : {
        id: String(lead.responsible_id),
        name: `Сотрудник #${lead.responsible_id}`,
      },
    source: persistedCommercial.source,
    createdAt: lead.created_at,
    lastActivityAt: activities.at(-1)?.occurredAt ?? lead.updated_at,
    estimatedAmount: persistedCommercial.estimatedAmount,
    probability: persistedCommercial.probability,
    commercial: persistedCommercial.commercial,
    activities,
    tasks: [],
    messages: [],
    taskReferenceAt: activities.at(-1)?.occurredAt ?? lead.updated_at,
    dataOrigin: "api",
    result: lead.result ?? undefined,
    completedAt: lead.completed_at ?? undefined,
    completedBy: lead.completed_by_id === null
      ? undefined
      : { id: String(lead.completed_by_id), name: `Сотрудник #${lead.completed_by_id}` },
    convertedOrderId: lead.converted_order_id === null ? undefined : String(lead.converted_order_id),
    convertedOrderNumber: lead.converted_order_id === null ? undefined : `#${lead.converted_order_id}`,
    rejectionReason: lead.rejection_reason_id === null ? undefined : `Причина #${lead.rejection_reason_id}`,
    rejectionComment: lead.rejection_comment ?? undefined,
    customer: {
      ...fromApiLeadCustomer(lead),
      contacts: lead.contacts.map(fromApiLeadContact),
    },
  };
}

export type LeadApiUpdate = {
  status?: string;
  source?: string | null;
  direction?: string | null;
  sport?: string | null;
  product_category?: string | null;
  product_type?: string | null;
  need_description?: string | null;
  estimated_quantity?: number | null;
  kit_quantity?: number | null;
  size_comment?: string | null;
  preliminary_budget?: number | null;
  estimated_amount?: number | null;
  discount_percent?: number | null;
  probability?: number | null;
  planned_order_date?: string | null;
  desired_date?: string | null;
  event_date?: string | null;
  delivery_city?: string | null;
  delivery_address?: string | null;
  delivery_method?: string | null;
  delivery_comment?: string | null;
  campaign?: string | null;
  utm_description?: string | null;
  priority?: string | null;
  customer_type?: "person" | "sole_proprietor" | "company" | null;
  company_name?: string | null;
  tax_id?: string | null;
  website?: string | null;
  city?: string | null;
  region?: string | null;
  address?: string | null;
  customer_comment?: string | null;
  responsible_id?: number | null;
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

  const apiLead = await response.json() as ApiLead;
  const historyResponse = await fetch(`${apiUrl.replace(/\/$/, "")}/leads/${leadId}/history`, {
    cache: "no-store",
  });
  if (!historyResponse.ok) {
    throw new Error(`Lead history API request failed with status ${historyResponse.status}`);
  }
  const history = await historyResponse.json() as ApiLeadEvent[];
  return fromApiLead(apiLead, history.map(fromApiLeadEvent));
}
