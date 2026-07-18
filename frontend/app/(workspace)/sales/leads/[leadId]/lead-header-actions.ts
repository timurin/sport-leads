"use server";

import { convertApiLead, updateApiLead } from "@/lib/sales/lead-details";
import type { LeadOrderDraft } from "@/components/sales/lead-completion-dialog";
import { toLeadConversionPayload } from "@/lib/sales/lead-conversion";

export type LeadHeaderActionResult = {
  ok: boolean;
  message: string;
};

const apiStatuses = new Set([
  "new",
  "contact",
  "qualification",
  "proposal",
  "waiting",
]);

export async function updateLeadStatus(
  leadId: string,
  status: string,
): Promise<LeadHeaderActionResult> {
  if (!/^\d+$/.test(leadId) || !apiStatuses.has(status)) {
    return { ok: false, message: "Не удалось изменить статус лида." };
  }

  try {
    const result = await updateApiLead(leadId, {
      status: status as "new" | "contact" | "qualification" | "proposal" | "waiting",
    });

    return result.ok
      ? { ok: true, message: "Статус обновлён." }
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
