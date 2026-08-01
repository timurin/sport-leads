"use server";

import {
  fromApiLeadMessage,
  type ApiLeadMessage,
} from "@/lib/sales/lead-message-api";
import type { LeadMessage, LeadMessageAttachment, LeadMessageChannel } from "@/types/sales";

export type LeadMessageActionResult =
  | { ok: true; messages: LeadMessage[]; message: string }
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

async function reloadMessages(leadId: string): Promise<LeadMessageActionResult> {
  const response = await fetch(`${apiBaseUrl()}/leads/${leadId}/messages`, { cache: "no-store" });
  if (!response.ok) {
    return { ok: false, message: await errorMessage(response) };
  }
  const messages = (await response.json() as ApiLeadMessage[]).map(fromApiLeadMessage);
  return { ok: true, messages, message: "Сообщения обновлены." };
}

export async function sendLeadMessage(
  leadId: string,
  payload: {
    channel: LeadMessageChannel;
    text: string;
    recipientName?: string;
    authorId: string | null;
    attachments: LeadMessageAttachment[];
  },
): Promise<LeadMessageActionResult> {
  if (!validId(leadId)) {
    return { ok: false, message: "Некорректный идентификатор лида." };
  }
  try {
    const response = await fetch(`${apiBaseUrl()}/leads/${leadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: payload.channel,
        text: payload.text,
        recipient_name: payload.recipientName ?? null,
        author_id: payload.authorId && validId(payload.authorId) ? Number(payload.authorId) : null,
        attachments: payload.attachments.map((attachment) => ({
          id: attachment.id,
          name: attachment.name,
          type: attachment.type ?? null,
          size: attachment.size ?? null,
        })),
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, message: await errorMessage(response) };
    }
    const result = await reloadMessages(leadId);
    return result.ok
      ? { ...result, message: "Сообщение сохранено (mock-отправка)." }
      : result;
  } catch {
    return { ok: false, message: "Не удалось связаться с backend. Сообщение не сохранено." };
  }
}
