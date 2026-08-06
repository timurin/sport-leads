"use server";

import { revalidatePath } from "next/cache";

import { fromApiSalesOrder, type SalesOrderDetails } from "@/lib/sales/order-details";

const apiBaseUrl = () =>
  (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export type PartyOption = { id: number; label: string };

export type SaveOrderPartyResult =
  | { ok: true; order: SalesOrderDetails }
  | { ok: false; message: string };

async function detailMessage(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { detail?: string | Array<{ msg?: string }> }
    | null;
  if (typeof payload?.detail === "string") return payload.detail;
  if (Array.isArray(payload?.detail) && payload.detail[0]?.msg) {
    return String(payload.detail[0].msg);
  }
  return null;
}

export async function listOrderPartyClients(): Promise<PartyOption[]> {
  const response = await fetch(`${apiBaseUrl()}/clients?limit=500`, { cache: "no-store" });
  if (!response.ok) return [];
  const rows = (await response.json()) as Array<{
    id: number;
    company_name?: string | null;
    contact_name?: string | null;
  }>;
  return rows
    .map((row) => ({
      id: row.id,
      label: (row.company_name?.trim() || row.contact_name || `Клиент #${row.id}`).trim(),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "ru"));
}

export async function listOrderPartyOrganizations(): Promise<PartyOption[]> {
  const response = await fetch(`${apiBaseUrl()}/organizations?active_only=true`, {
    cache: "no-store",
  });
  if (!response.ok) return [];
  const rows = (await response.json()) as Array<{ id: number; name: string }>;
  return rows
    .map((row) => ({ id: row.id, label: row.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "ru"));
}

export async function saveOrderClient(
  orderId: string,
  clientId: number,
): Promise<SaveOrderPartyResult> {
  const response = await fetch(`${apiBaseUrl()}/orders/${orderId}/client`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId }),
    cache: "no-store",
  });
  if (!response.ok) {
    return {
      ok: false,
      message: (await detailMessage(response)) ?? `Не удалось сменить клиента (${response.status})`,
    };
  }
  revalidatePath(`/sales/orders/${orderId}`);
  return { ok: true, order: fromApiSalesOrder(await response.json()) };
}

export async function saveOrderOrganization(
  orderId: string,
  organizationId: number | null,
): Promise<SaveOrderPartyResult> {
  const response = await fetch(`${apiBaseUrl()}/orders/${orderId}/organization`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organization_id: organizationId }),
    cache: "no-store",
  });
  if (!response.ok) {
    return {
      ok: false,
      message:
        (await detailMessage(response)) ?? `Не удалось сменить организацию (${response.status})`,
    };
  }
  revalidatePath(`/sales/orders/${orderId}`);
  return { ok: true, order: fromApiSalesOrder(await response.json()) };
}
