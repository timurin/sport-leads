"use server";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import {
  fromApiLeadCardFieldValue,
  type ApiLeadCardFieldValue,
  type LeadCardField,
  type LeadCardFieldBlock,
} from "@/lib/sales/lead-card-fields";

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string | Array<{ msg?: string }> };
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
    if (Array.isArray(body.detail)) {
      return body.detail.map((item) => item.msg).filter(Boolean).join(" ") || fallback;
    }
  } catch {
    /* ignore */
  }
  if (response.status === 401) return "Требуется вход";
  if (response.status === 403) return "Недостаточно прав для изменения полей карточки";
  return fallback;
}

export async function fetchLeadCardFields(leadId: string): Promise<LeadCardField[]> {
  if (!/^\d+$/.test(leadId)) return [];
  const response = await fetch(`${apiBaseUrl()}/leads/${leadId}/card-field-values`, {
    cache: "no-store",
  });
  if (!response.ok) return [];
  const rows = (await response.json()) as ApiLeadCardFieldValue[];
  return rows.map(fromApiLeadCardFieldValue);
}

export type LeadCardFieldActionResult =
  | { ok: true; fields: LeadCardField[] }
  | { ok: false; message: string };

export async function createLeadCardField(
  block: LeadCardFieldBlock,
  label: string,
  leadId: string,
): Promise<LeadCardFieldActionResult> {
  const trimmed = label.trim();
  if (!trimmed) return { ok: false, message: "Укажите название поля" };
  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/lead-card-fields`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({ block, label: trimmed }),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response, `Не удалось создать поле (${response.status}).`) };
  }
  return { ok: true, fields: await fetchLeadCardFields(leadId) };
}

export async function deleteLeadCardField(
  definitionId: number,
  leadId: string,
): Promise<LeadCardFieldActionResult> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/lead-card-fields/${definitionId}`, {
    method: "DELETE",
    headers: { ...auth },
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response, `Не удалось удалить поле (${response.status}).`) };
  }
  return { ok: true, fields: await fetchLeadCardFields(leadId) };
}

export async function saveLeadCardFieldValues(
  leadId: string,
  items: Array<{ id: number; value: string }>,
): Promise<LeadCardFieldActionResult> {
  if (!/^\d+$/.test(leadId)) {
    return { ok: false, message: "Demo-лид не сохраняет произвольные поля." };
  }
  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/leads/${leadId}/card-field-values`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({
      items: items.map((item) => ({ definition_id: item.id, value: item.value })),
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response, `Не удалось сохранить поля (${response.status}).`) };
  }
  const rows = (await response.json()) as ApiLeadCardFieldValue[];
  return { ok: true, fields: rows.map(fromApiLeadCardFieldValue) };
}
