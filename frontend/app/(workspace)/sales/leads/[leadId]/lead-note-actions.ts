"use server";

import { fromApiLeadEvent, type ApiLeadEvent } from "@/lib/sales/lead-history";
import { fromApiLeadNote, parsePersistedNoteId, type ApiLeadNote } from "@/lib/sales/lead-note-api";
import type { LeadActivity } from "@/types/sales";

export type LeadNoteActionResult =
  | { ok: true; activities: LeadActivity[]; message: string }
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
    // Keep a stable status fallback for empty / non-JSON bodies.
  }
  return `Backend отклонил запрос (${response.status}).`;
}

function mergeActivities(events: ApiLeadEvent[], notes: ApiLeadNote[]): LeadActivity[] {
  const history = events
    .filter((event) => event.event_type !== "comment_added")
    .map(fromApiLeadEvent);
  const noteActivities = notes.map(fromApiLeadNote);
  return [...history, ...noteActivities];
}

async function reloadLeadActivities(leadId: string): Promise<LeadNoteActionResult> {
  const [historyResponse, notesResponse] = await Promise.all([
    fetch(`${apiBaseUrl()}/leads/${leadId}/history`, { cache: "no-store" }),
    fetch(`${apiBaseUrl()}/leads/${leadId}/notes`, { cache: "no-store" }),
  ]);
  if (!historyResponse.ok) {
    return { ok: false, message: await errorMessage(historyResponse) };
  }
  if (!notesResponse.ok) {
    return { ok: false, message: await errorMessage(notesResponse) };
  }
  const events = await historyResponse.json() as ApiLeadEvent[];
  const notes = await notesResponse.json() as ApiLeadNote[];
  return {
    ok: true,
    activities: mergeActivities(events, notes),
    message: "Заметки обновлены.",
  };
}

export async function createLeadNote(
  leadId: string,
  body: string,
  mentionedUserIds: string[],
  authorId: string | null,
): Promise<LeadNoteActionResult> {
  if (!validId(leadId) || !body.trim()) {
    return { ok: false, message: "Проверьте текст заметки и повторите попытку." };
  }
  try {
    const response = await fetch(`${apiBaseUrl()}/leads/${leadId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: body.trim(),
        author_id: authorId && validId(authorId) ? Number(authorId) : null,
        mentioned_user_ids: mentionedUserIds.filter(validId).map(Number),
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, message: await errorMessage(response) };
    }
    const result = await reloadLeadActivities(leadId);
    return result.ok ? { ...result, message: "Заметка добавлена." } : result;
  } catch {
    return { ok: false, message: "Не удалось связаться с backend. Заметка не сохранена." };
  }
}

export async function updateLeadNote(
  leadId: string,
  noteActivityId: string,
  body: string,
  mentionedUserIds: string[],
): Promise<LeadNoteActionResult> {
  const noteId = parsePersistedNoteId(noteActivityId);
  if (!validId(leadId) || noteId === null || !body.trim()) {
    return { ok: false, message: "Проверьте данные заметки и повторите попытку." };
  }
  try {
    const response = await fetch(`${apiBaseUrl()}/leads/${leadId}/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: body.trim(),
        mentioned_user_ids: mentionedUserIds.filter(validId).map(Number),
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, message: await errorMessage(response) };
    }
    const result = await reloadLeadActivities(leadId);
    return result.ok ? { ...result, message: "Заметка обновлена." } : result;
  } catch {
    return { ok: false, message: "Не удалось связаться с backend. Заметка не обновлена." };
  }
}

export async function deleteLeadNote(
  leadId: string,
  noteActivityId: string,
): Promise<LeadNoteActionResult> {
  const noteId = parsePersistedNoteId(noteActivityId);
  if (!validId(leadId) || noteId === null) {
    return { ok: false, message: "Некорректный идентификатор заметки." };
  }
  try {
    const response = await fetch(`${apiBaseUrl()}/leads/${leadId}/notes/${noteId}`, {
      method: "DELETE",
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, message: await errorMessage(response) };
    }
    const result = await reloadLeadActivities(leadId);
    return result.ok ? { ...result, message: "Заметка удалена." } : result;
  } catch {
    return { ok: false, message: "Не удалось связаться с backend. Заметка не удалена." };
  }
}

export async function toggleLeadNotePin(
  leadId: string,
  noteActivityId: string,
): Promise<LeadNoteActionResult> {
  const noteId = parsePersistedNoteId(noteActivityId);
  if (!validId(leadId) || noteId === null) {
    return { ok: false, message: "Некорректный идентификатор заметки." };
  }
  try {
    const response = await fetch(`${apiBaseUrl()}/leads/${leadId}/notes/${noteId}/toggle-pin`, {
      method: "POST",
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, message: await errorMessage(response) };
    }
    const result = await reloadLeadActivities(leadId);
    return result.ok ? { ...result, message: "Закрепление заметки обновлено." } : result;
  } catch {
    return { ok: false, message: "Не удалось связаться с backend. Закрепление не изменено." };
  }
}
