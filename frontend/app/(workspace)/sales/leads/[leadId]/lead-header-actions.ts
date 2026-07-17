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
