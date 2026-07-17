export type ParsedNumber = {
  value?: number;
  error?: string;
};

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function parsePositiveInteger(value: string): ParsedNumber {
  if (!value.trim()) {
    return {};
  }

  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    return { error: "Укажите целое число не меньше 1." };
  }

  return { value: number };
}

export function parseNonNegativeNumber(value: string): ParsedNumber {
  if (!value.trim()) {
    return {};
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return { error: "Укажите неотрицательное число." };
  }

  return { value: number };
}

export function parsePercent(value: string): ParsedNumber {
  const parsed = parseNonNegativeNumber(value);
  if (parsed.error || parsed.value === undefined) {
    return parsed;
  }

  return parsed.value <= 100
    ? parsed
    : { error: "Значение должно быть от 0 до 100%." };
}

export function validateCommercialDates(plannedOrderDate: string, desiredReadyDate: string) {
  if (plannedOrderDate && desiredReadyDate && desiredReadyDate < plannedOrderDate) {
    return "Желаемая дата готовности не может быть раньше даты заказа.";
  }
  return undefined;
}

export function getEventDateWarning(desiredReadyDate: string, eventDate: string) {
  if (desiredReadyDate && eventDate && desiredReadyDate > eventDate) {
    return "Дата готовности позже даты мероприятия. Проверьте сроки.";
  }
  return undefined;
}

export function formatCurrency(value?: number | null) {
  return value === undefined || value === null || !Number.isFinite(value) || value < 0
    ? "Не указано"
    : currencyFormatter.format(value);
}

export function formatCommercialDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "Не указано";
  }
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? "Не указано"
    : dateFormatter.format(date).replace(/\s*г\.$/, "");
}

export function formatQuantity(value?: number, unit: "item" | "kit" = "item") {
  if (value === undefined || !Number.isInteger(value) || value < 1) {
    return "Не указано";
  }

  const mod10 = value % 10;
  const mod100 = value % 100;
  const forms = unit === "kit"
    ? ["комплект", "комплекта", "комплектов"]
    : ["изделие", "изделия", "изделий"];
  const form = mod10 === 1 && mod100 !== 11
    ? forms[0]
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
      ? forms[1]
      : forms[2];

  return `${value} ${form}`;
}
