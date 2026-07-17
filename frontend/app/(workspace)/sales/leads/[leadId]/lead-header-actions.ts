"use server";

import { updateApiLead } from "@/lib/sales/lead-details";

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
    const ok = await updateApiLead(leadId, {
      status: status as "new" | "contact" | "qualification" | "proposal" | "waiting",
    });

    return ok
      ? { ok: true, message: "Статус обновлён." }
      : { ok: false, message: "Backend отклонил изменение статуса." };
  } catch {
    return { ok: false, message: "Не удалось связаться с backend." };
  }
}
