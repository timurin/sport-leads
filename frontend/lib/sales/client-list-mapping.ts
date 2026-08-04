import type { Client, ClientStatus, UserSummary } from "@/types/sales";

export type ApiClientListItem = {
  id: number;
  company_name: string | null;
  contact_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  responsible_id: number | null;
  responsible_name: string | null;
  orders_count: number;
  sales_amount: number | string;
  primary_sport: string | null;
  created_at: string;
  updated_at: string;
};

const fallbackManager: UserSummary = {
  id: "unassigned",
  name: "Не назначен",
  initials: "НН",
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function managerFromApi(item: ApiClientListItem): UserSummary {
  if (item.responsible_id === null) {
    return item.responsible_name
      ? {
          id: "named-unassigned",
          name: item.responsible_name,
          initials: initialsFromName(item.responsible_name),
        }
      : fallbackManager;
  }
  const name = item.responsible_name ?? `Сотрудник #${item.responsible_id}`;
  return {
    id: String(item.responsible_id),
    name,
    initials: initialsFromName(name),
  };
}

function deriveStatus(ordersCount: number): ClientStatus {
  return ordersCount > 0 ? "active" : "new";
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
}

/** Map persistent `/clients` row → list table Client (honest defaults for missing CRM fields). */
export function fromApiClientListItem(item: ApiClientListItem): Client {
  const salesAmount = Number(item.sales_amount ?? 0);
  const updatedMs = new Date(item.updated_at).getTime();
  return {
    id: String(item.id),
    name: item.company_name?.trim() || item.contact_name,
    type: "Клиент",
    contact: item.contact_name,
    phone: item.phone ?? "—",
    email: item.email ?? "—",
    city: item.city ?? "Не указан",
    sport: item.primary_sport ?? "Не указан",
    ordersCount: item.orders_count ?? 0,
    salesAmount: Number.isFinite(salesAmount) ? salesAmount : 0,
    lastContact: displayDate(item.updated_at),
    lastContactOrder: Number.isFinite(updatedMs) ? updatedMs : 0,
    responsible: managerFromApi(item),
    status: deriveStatus(item.orders_count ?? 0),
  };
}
