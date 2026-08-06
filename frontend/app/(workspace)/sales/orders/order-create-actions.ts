"use server";

import { revalidatePath } from "next/cache";

import {
  createApiSalesOrder,
  type CreateSalesOrderPayload,
} from "@/lib/sales/order-list-api";

function apiBaseUrl() {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

export type CreateOrderActionResult =
  | { ok: true; orderId: string; message: string }
  | { ok: false; message: string };

export type CreateClientPayload = {
  contact_name: string;
  company_name?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  responsible_id?: number | null;
  organization_id?: number | null;
  organization_name?: string | null;
  tax_id?: string | null;
  ogrn?: string | null;
};

export type CreateClientActionResult =
  | {
      ok: true;
      clientId: string;
      label: string;
      organizationId: number | null;
      responsibleId: number | null;
      message: string;
    }
  | { ok: false; message: string };

async function detailMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | { detail?: string | { msg?: string }[] }
    | null;
  if (typeof body?.detail === "string") return body.detail;
  if (Array.isArray(body?.detail)) {
    return body.detail.map((item) => item.msg).filter(Boolean).join("; ");
  }
  return null;
}

export async function createClientAction(
  payload: CreateClientPayload,
): Promise<CreateClientActionResult> {
  try {
    const response = await fetch(`${apiBaseUrl()}/clients`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        ok: false,
        message:
          (await detailMessage(response))
          || `Backend не создал клиента (${response.status}).`,
      };
    }
    const client = (await response.json()) as {
      id: number;
      company_name: string | null;
      contact_name: string;
      organization_id: number | null;
      default_organization_id?: number | null;
      responsible_id: number | null;
    };
    revalidatePath("/sales/clients");
    revalidatePath("/sales/orders");
    return {
      ok: true,
      clientId: String(client.id),
      label: client.company_name?.trim() || client.contact_name,
      organizationId: client.default_organization_id ?? client.organization_id,
      responsibleId: client.responsible_id,
      message: "Клиент создан.",
    };
  } catch {
    return { ok: false, message: "Не удалось связаться с backend." };
  }
}

export async function createSalesOrderAction(
  payload: CreateSalesOrderPayload,
): Promise<CreateOrderActionResult> {
  try {
    const result = await createApiSalesOrder(payload);
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    revalidatePath("/sales/orders");
    return {
      ok: true,
      orderId: String(result.order.id),
      message: "Заказ создан.",
    };
  } catch {
    return { ok: false, message: "Не удалось связаться с backend." };
  }
}
