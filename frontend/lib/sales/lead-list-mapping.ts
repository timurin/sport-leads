import type { ApiLeadContact } from "@/lib/sales/lead-contact-api";
import type { Lead, LeadResult, LeadStatus, Priority, UserSummary } from "@/types/sales";

export type ApiLeadListItem = {
  id: number;
  status: string;
  result: LeadResult | null;
  company_name: string | null;
  contact_name: string;
  city: string | null;
  source: string | null;
  responsible_id: number | null;
  sport: string | null;
  product_category: string | null;
  need_description: string | null;
  estimated_quantity: number | null;
  estimated_amount: number | string | null;
  desired_date: string | null;
  completed_at: string | null;
  completed_by_id: number | null;
  converted_order_id: number | null;
  rejection_reason_id: number | null;
  rejection_comment: string | null;
  contacts: ApiLeadContact[];
};

const fallbackManager: UserSummary = {
  id: "unassigned",
  name: "Не назначен",
  initials: "НН",
};

const statusMap: Partial<Record<LeadStatus, LeadStatus>> = {
  new: "new",
  contact: "contact",
  qualification: "qualification",
  proposal: "proposal",
  waiting: "waiting",
  completed: "completed",
};

function managerFromId(responsibleId: number | null): UserSummary {
  if (responsibleId === null) {
    return fallbackManager;
  }
  return {
    id: String(responsibleId),
    name: `Сотрудник #${responsibleId}`,
    initials: `#${responsibleId}`,
  };
}

function primaryContact(lead: ApiLeadListItem) {
  return lead.contacts.find((contact) => contact.is_primary) ?? lead.contacts[0] ?? null;
}

function displayDate(value: string | null) {
  if (!value) {
    return undefined;
  }
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
}

export function fromApiLeadListItem(lead: ApiLeadListItem): Lead {
  const contact = primaryContact(lead);
  const status = statusMap[lead.status as LeadStatus] ?? "new";
  const estimatedAmount = lead.estimated_amount === null ? 0 : Number(lead.estimated_amount);
  return {
    id: String(lead.id),
    status,
    stageId: lead.status === "completed" ? undefined : lead.status,
    result: lead.result ?? undefined,
    clientName: lead.company_name ?? contact?.name ?? lead.contact_name,
    contact: contact?.name ?? lead.contact_name,
    city: lead.city ?? "Не указан",
    sport: lead.sport ?? "Не указан",
    estimatedAmount,
    source: lead.source ?? "Не указан",
    responsible: managerFromId(lead.responsible_id),
    nextContact: lead.completed_at ? "Завершён" : "Не запланирован",
    priority: "medium" satisfies Priority,
    completedAt: displayDate(lead.completed_at),
    completedBy: lead.completed_by_id === null ? undefined : managerFromId(lead.completed_by_id),
    convertedOrderId: lead.converted_order_id === null ? undefined : String(lead.converted_order_id),
    convertedOrderNumber: lead.converted_order_id === null ? undefined : `#${lead.converted_order_id}`,
    rejectionReason: lead.rejection_reason_id === null ? undefined : `Причина #${lead.rejection_reason_id}`,
    rejectionComment: lead.rejection_comment ?? undefined,
    productCategory: lead.product_category ?? undefined,
    quantity: lead.estimated_quantity ?? undefined,
    needDescription: lead.need_description ?? undefined,
    desiredDate: lead.desired_date ?? undefined,
  };
}
