"use server";

import {
  fromApiLeadCommercial,
  toApiLeadCommercialPayload,
  validateLeadCommercialCore,
  type LeadCommercialCore,
  type LeadCommercialCoreInput,
} from "@/lib/sales/lead-commercial-api";
import { updateApiLead } from "@/lib/sales/lead-details";

export type LeadCommercialActionResult =
  | { ok: true; persisted: LeadCommercialCore; message: string }
  | { ok: false; message: string };

export async function saveLeadCommercialDetails(
  leadId: string,
  input: LeadCommercialCoreInput,
): Promise<LeadCommercialActionResult> {
  if (!/^\d+$/.test(leadId)) {
    return { ok: false, message: "Коммерческие параметры demo-лида сохраняются только локально." };
  }
  const validationError = validateLeadCommercialCore(input);
  if (validationError) {
    return { ok: false, message: validationError };
  }

  try {
    const result = await updateApiLead(leadId, toApiLeadCommercialPayload(input));
    return result.ok
      ? {
        ok: true,
        persisted: fromApiLeadCommercial(result.lead),
        message: "Коммерческие параметры сохранены.",
      }
      : { ok: false, message: result.message };
  } catch {
    return { ok: false, message: "Не удалось связаться с backend. Изменения не сохранены." };
  }
}
