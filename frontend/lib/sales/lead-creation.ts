export type LeadCreateDraft = {
  contactName: string;
  companyName: string;
  phone: string;
  email: string;
  city: string;
  source: string;
};

export type LeadCreatePayload = {
  contact_name: string;
  company_name?: string;
  phone?: string;
  email?: string;
  city?: string;
  source?: string;
};

export class LeadCreateValidationError extends Error {}

const limits = {
  contactName: 255,
  companyName: 255,
  phone: 50,
  email: 255,
  city: 150,
  source: 150,
} as const;

function readField(input: Record<string, unknown>, key: keyof LeadCreateDraft) {
  const value = input[key];
  if (typeof value !== "string") {
    throw new LeadCreateValidationError("Проверьте данные формы создания лида.");
  }
  const trimmed = value.trim();
  if (trimmed.length > limits[key]) {
    throw new LeadCreateValidationError("Одно из полей превышает допустимую длину.");
  }
  return trimmed;
}

export function toLeadCreatePayload(input: unknown): LeadCreatePayload {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new LeadCreateValidationError("Проверьте данные формы создания лида.");
  }
  const record = input as Record<string, unknown>;
  const contactName = readField(record, "contactName");
  const companyName = readField(record, "companyName");
  const phone = readField(record, "phone");
  const email = readField(record, "email");
  const city = readField(record, "city");
  const source = readField(record, "source");

  if (!contactName) {
    throw new LeadCreateValidationError("Укажите имя контактного лица.");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new LeadCreateValidationError("Укажите корректный email.");
  }

  return {
    contact_name: contactName,
    ...(companyName ? { company_name: companyName } : {}),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    ...(city ? { city } : {}),
    ...(source ? { source } : {}),
  };
}
