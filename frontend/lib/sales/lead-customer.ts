export type CustomerFieldErrors = Partial<Record<"email" | "phone" | "taxId", string>>;
export type ContactFieldErrors = Partial<Record<"name" | "email" | "phone", string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+\d\s()-]+$/;

export function validateCustomerFields(values: {
  email: string;
  phone: string;
  taxId: string;
}): CustomerFieldErrors {
  const errors: CustomerFieldErrors = {};
  const email = values.email.trim();
  const phone = values.phone.trim();
  const taxId = values.taxId.trim();

  if (email && !emailPattern.test(email)) {
    errors.email = "Введите корректный email.";
  }

  if (phone && !phonePattern.test(phone)) {
    errors.phone = "Используйте цифры, пробелы, +, скобки или дефисы.";
  }

  if (taxId && !/^\d{10}$|^\d{12}$/.test(taxId)) {
    errors.taxId = "ИНН должен содержать 10 или 12 цифр.";
  }

  return errors;
}

export function validateContactFields(values: {
  name: string;
  email: string;
  phone: string;
}): ContactFieldErrors {
  const errors: ContactFieldErrors = {};
  const customerErrors = validateCustomerFields({ ...values, taxId: "" });

  if (!values.name.trim()) {
    errors.name = "Укажите имя контактного лица.";
  }

  if (customerErrors.email) {
    errors.email = customerErrors.email;
  }

  if (customerErrors.phone) {
    errors.phone = customerErrors.phone;
  }

  return errors;
}

export function getWebsiteHref(website: string): string {
  const value = website.trim();
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function optionalText(value: string): string | undefined {
  return value.trim() || undefined;
}
