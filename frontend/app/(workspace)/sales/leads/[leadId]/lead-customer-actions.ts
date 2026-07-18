"use server";

import {
  fromApiLeadCustomer,
  toApiLeadCustomerPayload,
  validateLeadCustomerProfile,
  type LeadCustomerProfileInput,
} from "@/lib/sales/lead-customer-api";
import { updateApiLead } from "@/lib/sales/lead-details";
import type { LeadCustomer } from "@/types/sales";

export type LeadCustomerProfileActionResult =
  | { ok: true; customer: Omit<LeadCustomer, "contacts">; message: string }
  | { ok: false; message: string };

export async function saveLeadCustomerProfile(
  leadId: string,
  input: LeadCustomerProfileInput,
): Promise<LeadCustomerProfileActionResult> {
  if (!/^\d+$/.test(leadId)) {
    return { ok: false, message: "Профиль demo-лида сохраняется только локально." };
  }
  const validationError = validateLeadCustomerProfile(input);
  if (validationError) {
    return { ok: false, message: validationError };
  }

  try {
    const result = await updateApiLead(leadId, toApiLeadCustomerPayload(input));
    return result.ok
      ? {
        ok: true,
        customer: fromApiLeadCustomer(result.lead),
        message: "Профиль клиента сохранён.",
      }
      : { ok: false, message: result.message };
  } catch {
    return { ok: false, message: "Не удалось связаться с backend. Изменения не сохранены." };
  }
}
