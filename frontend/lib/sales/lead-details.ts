import "server-only";

import { fromApiLeadCommercial, type ApiLeadCommercialFields } from "@/lib/sales/lead-commercial-api";
import { fromApiLeadContact, type ApiLeadContact } from "@/lib/sales/lead-contact-api";
import { fromApiLeadCustomer, type ApiLeadCustomerFields } from "@/lib/sales/lead-customer-api";
import { resolveLeadDetailStage } from "@/lib/sales/lead-detail-stage";
import { findBackendReasonId, type ApiLeadRejectionReason } from "@/lib/sales/lead-rejection";
import { fromApiLeadEvent, type ApiLeadEvent } from "@/lib/sales/lead-history";
import { fromApiLeadMessage, leadMessageToActivity, type ApiLeadMessage } from "@/lib/sales/lead-message-api";
import { fromApiLeadNote, type ApiLeadNote } from "@/lib/sales/lead-note-api";
import { fromApiLeadTask, fromApiSalesUser, type ApiLeadTask, type ApiSalesUser } from "@/lib/sales/lead-task-api";
import { getMe, platformUserToSummary } from "@/lib/auth/session";
import type { LeadActivity, LeadCommercialDetailsData, LeadCustomer, LeadMessage, LeadResult, LeadStatus, LeadTask, UserSummary } from "@/types/sales";

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
  taskManagers: UserSummary[];
  currentActor: UserSummary;
  messages: LeadMessage[];
  taskReferenceAt: string;
  dataOrigin: "api";
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

function fromApiLead(
  lead: ApiLead,
  activities: LeadActivity[],
  tasks: LeadTask[],
  taskManagers: UserSummary[],
  currentActor: UserSummary,
  messages: LeadMessage[],
): LeadDetails {
  const persistedCommercial = fromApiLeadCommercial(lead);
  const stageState = resolveLeadDetailStage(lead.status);
  const lastActivityAt = activities.reduce((latest, activity) => {
    const stamp = Date.parse(activity.occurredAt);
    const latestStamp = Date.parse(latest);
    if (Number.isNaN(stamp)) return latest;
    if (Number.isNaN(latestStamp) || stamp > latestStamp) return activity.occurredAt;
    return latest;
  }, lead.updated_at);
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
    lastActivityAt,
    estimatedAmount: persistedCommercial.estimatedAmount,
    probability: persistedCommercial.probability,
    commercial: persistedCommercial.commercial,
    activities,
    tasks,
    taskManagers,
    currentActor,
    messages,
    taskReferenceAt: lastActivityAt,
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
  const [historyResponse, tasksResponse, notesResponse, messagesResponse, usersResponse] = await Promise.all([
    fetch(`${apiUrl.replace(/\/$/, "")}/leads/${leadId}/history`, { cache: "no-store" }),
    fetch(`${apiUrl.replace(/\/$/, "")}/leads/${leadId}/tasks`, { cache: "no-store" }),
    fetch(`${apiUrl.replace(/\/$/, "")}/leads/${leadId}/notes`, { cache: "no-store" }),
    fetch(`${apiUrl.replace(/\/$/, "")}/leads/${leadId}/messages`, { cache: "no-store" }),
    fetch(`${apiUrl.replace(/\/$/, "")}/sales-users?is_active=true`, { cache: "no-store" }),
  ]);
  if (!historyResponse.ok) {
    throw new Error(`Lead history API request failed with status ${historyResponse.status}`);
  }
  if (!tasksResponse.ok) {
    throw new Error(`Lead tasks API request failed with status ${tasksResponse.status}`);
  }
  if (!notesResponse.ok) {
    throw new Error(`Lead notes API request failed with status ${notesResponse.status}`);
  }
  if (!messagesResponse.ok) {
    throw new Error(`Lead messages API request failed with status ${messagesResponse.status}`);
  }
  if (!usersResponse.ok) {
    throw new Error(`Sales users API request failed with status ${usersResponse.status}`);
  }
  const history = await historyResponse.json() as ApiLeadEvent[];
  const tasks = (await tasksResponse.json() as ApiLeadTask[]).map(fromApiLeadTask);
  const notes = (await notesResponse.json() as ApiLeadNote[]).map(fromApiLeadNote);
  const messages = (await messagesResponse.json() as ApiLeadMessage[]).map(fromApiLeadMessage);
  const taskManagers = (await usersResponse.json() as ApiSalesUser[]).map(fromApiSalesUser);
  const managers: UserSummary[] = taskManagers.length > 0
    ? taskManagers
    : apiLead.responsible_id === null
      ? [{ id: "1", name: "System", initials: "SY" }]
      : [{
        id: String(apiLead.responsible_id),
        name: `Сотрудник #${apiLead.responsible_id}`,
        initials: `#${apiLead.responsible_id}`,
      }];
  const me = await getMe();
  const currentActor = me
    ? platformUserToSummary(me)
    : managers.find((manager) => manager.id === "1")
      ?? managers[0]
      ?? { id: "1", name: "System", initials: "SY" };
  const historyActivities = history
    .filter((event) => event.event_type !== "comment_added")
    .map(fromApiLeadEvent);
  const messageActivities = messages.map(leadMessageToActivity);
  const activities = [...historyActivities, ...notes, ...messageActivities];
  return fromApiLead(apiLead, activities, tasks, managers, currentActor, messages);
}
