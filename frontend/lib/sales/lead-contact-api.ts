import type { CommunicationChannel, LeadContact } from "@/types/sales";

export type ApiLeadContact = {
  id: number;
  lead_id: number;
  name: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  preferred_channel: CommunicationChannel;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

export type LeadContactMutationInput = {
  name: string;
  position?: string;
  phone?: string;
  email?: string;
  preferredChannel: CommunicationChannel;
  isPrimary: boolean;
};

export function fromApiLeadContact(contact: ApiLeadContact): LeadContact {
  return {
    id: String(contact.id),
    name: contact.name,
    position: contact.position ?? undefined,
    phone: contact.phone ?? undefined,
    email: contact.email ?? undefined,
    preferredChannel: contact.preferred_channel,
    isPrimary: contact.is_primary,
  };
}

export function toApiLeadContactPayload(input: LeadContactMutationInput) {
  return {
    name: input.name.trim(),
    position: input.position?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    preferred_channel: input.preferredChannel,
  };
}
