"use server";

import { convertApiLead, rejectApiLead, updateApiLead } from "@/lib/sales/lead-details";
import type { LeadOrderDraft, RejectionReasonOption } from "@/components/sales/lead-completion-dialog";
import { toLeadConversionPayload } from "@/lib/sales/lead-conversion";

export type LeadHeaderActionResult = {
  ok: boolean;
  message: string;
};

export async function updateLeadStatus(
  leadId: string,
  status: string,
): Promise<LeadHeaderActionResult> {
  if (!/^\d+$/.test(leadId) || !/^[a-z][a-z0-9-]{0,63}$/.test(status) || status === "completed") {
    return { ok: false, message: "Не удалось изменить статус лида." };
  }

  try {
    const result = await updateApiLead(leadId, { status });

    return result.ok
      ? { ok: true, message: "Статус обновлён." }
      : { ok: false, message: result.message };
  } catch {
    return { ok: false, message: "Не удалось связаться с backend." };
  }
}

export async function updateLeadResponsible(
  leadId: string,
  responsibleId: string | null,
): Promise<LeadHeaderActionResult> {
  if (!/^\d+$/.test(leadId) || (responsibleId !== null && !/^\d+$/.test(responsibleId))) {
    return { ok: false, message: "Не удалось изменить ответственного." };
  }

  try {
    const result = await updateApiLead(leadId, {
      responsible_id: responsibleId === null ? null : Number(responsibleId),
    });

    return result.ok
      ? { ok: true, message: "Ответственный обновлён." }
      : { ok: false, message: result.message };
  } catch {
    return { ok: false, message: "Не удалось связаться с backend." };
  }
}

export async function convertLead(
  leadId: string,
  draft: LeadOrderDraft,
): Promise<LeadHeaderActionResult & { orderId?: string; orderNumber?: string }> {
  if (!/^\d+$/.test(leadId)) {
    return { ok: false, message: "Конвертация доступна только для числового API-лида." };
  }

  try {
    const result = await convertApiLead(leadId, toLeadConversionPayload(draft));

    return result.ok
      ? {
          ok: true,
          message: "Лид конвертирован, заказ сохранён.",
          orderId: String(result.conversion.order.id),
          orderNumber: result.conversion.order.number,
        }
      : { ok: false, message: result.message };
  } catch {
    return { ok: false, message: "Не удалось связаться с backend. Конвертация отменена." };
  }
}

export async function rejectLead(
  leadId: string,
  reason: RejectionReasonOption,
  comment: string,
): Promise<LeadHeaderActionResult> {
  if (!/^\d+$/.test(leadId)) {
    return { ok: false, message: "Отказ доступен только для числового API-лида." };
  }

  try {
    const result = await rejectApiLead(leadId, reason.id, comment);
    return result.ok
      ? { ok: true, message: "Отказ лида сохранён." }
      : { ok: false, message: result.message };
  } catch {
    return { ok: false, message: "Не удалось связаться с backend. Отказ отменён." };
  }
}
