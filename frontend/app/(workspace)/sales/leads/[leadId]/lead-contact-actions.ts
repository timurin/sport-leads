"use server";

import {
  fromApiLeadContact,
  toApiLeadContactPayload,
  type ApiLeadContact,
  type LeadContactMutationInput,
} from "@/lib/sales/lead-contact-api";
import type { LeadContact } from "@/types/sales";

export type LeadContactActionResult =
  | { ok: true; contacts: LeadContact[]; savedContactId?: string; message: string }
  | { ok: false; message: string };

function apiBaseUrl() {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

function validId(value: string) {
  return /^\d+$/.test(value);
}

async function errorMessage(response: Response) {
  try {
    const body = await response.json() as { detail?: string | Array<{ msg?: string }> };
    if (typeof body.detail === "string") {
      return body.detail;
    }
    if (Array.isArray(body.detail)) {
      return body.detail.map((item) => item.msg).filter(Boolean).join(" ");
    }
  } catch {
    // The status-based message below is stable even for an empty/non-JSON response.
  }
  return `Backend отклонил запрос (${response.status}).`;
}

async function loadContacts(leadId: string): Promise<LeadContactActionResult> {
  const response = await fetch(`${apiBaseUrl()}/leads/${leadId}`, { cache: "no-store" });
  if (!response.ok) {
    return { ok: false, message: await errorMessage(response) };
  }
  const lead = await response.json() as { contacts?: ApiLeadContact[] };
  return {
    ok: true,
    contacts: (lead.contacts ?? []).map(fromApiLeadContact),
    message: "Контакты обновлены.",
  };
}

export async function saveLeadContact(
  leadId: string,
  contactId: string | null,
  input: LeadContactMutationInput,
): Promise<LeadContactActionResult> {
  if (!validId(leadId) || (contactId !== null && !validId(contactId)) || !input.name.trim()) {
    return { ok: false, message: "Проверьте данные контакта и повторите попытку." };
  }

  try {
    const endpoint = contactId === null
      ? `${apiBaseUrl()}/leads/${leadId}/contacts`
      : `${apiBaseUrl()}/leads/${leadId}/contacts/${contactId}`;
    const payload = contactId === null
      ? { ...toApiLeadContactPayload(input), is_primary: input.isPrimary }
      : toApiLeadContactPayload(input);
    let response = await fetch(endpoint, {
      method: contactId === null ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, message: await errorMessage(response) };
    }

    let saved = await response.json() as ApiLeadContact;
    if (contactId !== null && input.isPrimary && !saved.is_primary) {
      response = await fetch(`${apiBaseUrl()}/leads/${leadId}/contacts/${contactId}/set-primary`, {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) {
        return { ok: false, message: await errorMessage(response) };
      }
      saved = await response.json() as ApiLeadContact;
    }

    const result = await loadContacts(leadId);
    return result.ok
      ? { ...result, savedContactId: String(saved.id), message: contactId === null ? "Контакт добавлен." : "Контакт обновлён." }
      : result;
  } catch {
    return { ok: false, message: "Не удалось связаться с backend. Изменения не сохранены." };
  }
}

export async function deleteLeadContact(
  leadId: string,
  contactId: string,
): Promise<LeadContactActionResult> {
  if (!validId(leadId) || !validId(contactId)) {
    return { ok: false, message: "Некорректный идентификатор контакта." };
  }

  try {
    const response = await fetch(`${apiBaseUrl()}/leads/${leadId}/contacts/${contactId}`, {
      method: "DELETE",
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, message: await errorMessage(response) };
    }
    const result = await loadContacts(leadId);
    return result.ok ? { ...result, message: "Контакт удалён." } : result;
  } catch {
    return { ok: false, message: "Не удалось связаться с backend. Контакт не удалён." };
  }
}
