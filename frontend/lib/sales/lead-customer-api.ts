import type { LeadCustomer, LeadCustomerType } from "@/types/sales";

export type ApiLeadCustomerFields = {
  customer_type: LeadCustomerType | null;
  company_name: string | null;
  tax_id: string | null;
  website: string | null;
  city: string | null;
  region: string | null;
  address: string | null;
  customer_comment: string | null;
};

export type LeadCustomerProfileInput = {
  type?: LeadCustomerType;
  organizationName?: string;
  taxId?: string;
  website?: string;
  city?: string;
  region?: string;
  address?: string;
  comment?: string;
};

const customerTypes = new Set<LeadCustomerType>(["person", "sole_proprietor", "company"]);

export function validateLeadCustomerProfile(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "Некорректный формат профиля клиента.";
  }
  const input = value as Partial<LeadCustomerProfileInput>;
  if (input.type !== undefined && !customerTypes.has(input.type)) {
    return "Тип клиента указан некорректно.";
  }
  const limitedText: Array<[string | undefined, number]> = [
    [input.organizationName, 255],
    [input.taxId, 12],
    [input.website, 255],
    [input.city, 150],
    [input.region, 150],
    [input.address, 500],
  ];
  if (limitedText.some(([item, limit]) => item !== undefined && (typeof item !== "string" || item.trim().length > limit))) {
    return "Одно из полей профиля клиента имеет некорректный формат.";
  }
  if (input.comment !== undefined && typeof input.comment !== "string") {
    return "Комментарий клиента имеет некорректный формат.";
  }
  if (typeof input.taxId === "string" && input.taxId.trim() && !/^(\d{10}|\d{12})$/.test(input.taxId.trim())) {
    return "ИНН должен содержать 10 или 12 цифр.";
  }
  return undefined;
}

export function toApiLeadCustomerPayload(input: LeadCustomerProfileInput) {
  return {
    customer_type: input.type ?? null,
    company_name: input.organizationName?.trim() || null,
    tax_id: input.taxId?.trim() || null,
    website: input.website?.trim() || null,
    city: input.city?.trim() || null,
    region: input.region?.trim() || null,
    address: input.address?.trim() || null,
    customer_comment: input.comment?.trim() || null,
  };
}

export function fromApiLeadCustomer(lead: ApiLeadCustomerFields): Omit<LeadCustomer, "contacts"> {
  return {
    type: lead.customer_type ?? undefined,
    organizationName: lead.company_name ?? undefined,
    taxId: lead.tax_id ?? undefined,
    website: lead.website ?? undefined,
    city: lead.city ?? undefined,
    region: lead.region ?? undefined,
    address: lead.address ?? undefined,
    comment: lead.customer_comment ?? undefined,
  };
}
