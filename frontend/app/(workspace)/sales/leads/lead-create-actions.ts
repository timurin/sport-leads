"use server";

import { createApiLead } from "@/lib/sales/lead-create-api";
import {
  LeadCreateValidationError,
  toLeadCreatePayload,
} from "@/lib/sales/lead-creation";
import { fromApiLeadListItem } from "@/lib/sales/lead-list-mapping";
import type { Lead } from "@/types/sales";

export type LeadCreateActionResult =
  | { ok: true; lead: Lead }
  | { ok: false; message: string };

export async function createLead(input: unknown): Promise<LeadCreateActionResult> {
  try {
    const result = await createApiLead(toLeadCreatePayload(input));
    return result.ok
      ? { ok: true, lead: fromApiLeadListItem(result.lead) }
      : result;
  } catch (error) {
    if (error instanceof LeadCreateValidationError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Не удалось создать лид." };
  }
}
