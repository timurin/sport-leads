import type { LeadCommercialDetailsData } from "@/types/sales";

export type ApiLeadCommercialFields = {
  source: string | null;
  direction?: string | null;
  sport: string | null;
  product_category: string | null;
  product_type?: string | null;
  need_description: string | null;
  estimated_quantity: number | null;
  kit_quantity?: number | null;
  size_comment?: string | null;
  preliminary_budget?: number | string | null;
  estimated_amount: number | string | null;
  discount_percent?: number | string | null;
  probability?: number | string | null;
  planned_order_date?: string | null;
  desired_date: string | null;
  event_date?: string | null;
  delivery_city?: string | null;
  city?: string | null;
  delivery_address?: string | null;
  delivery_method?: string | null;
  delivery_comment?: string | null;
  campaign?: string | null;
  utm_description?: string | null;
  priority?: string | null;
};

export type LeadCommercialCoreInput = {
  source: string | null;
  direction?: string;
  sport?: string;
  productCategory?: string;
  productType?: string;
  needDescription?: string;
  estimatedQuantity?: number;
  kitQuantity?: number;
  sizeComment?: string;
  preliminaryBudget?: number | null;
  estimatedAmount: number | null;
  discountPercent?: number | null;
  probability?: number | null;
  plannedOrderDate?: string;
  desiredReadyDate?: string;
  eventDate?: string;
  deliveryCity?: string;
  deliveryAddress?: string;
  deliveryMethod?: string;
  deliveryComment?: string;
  campaign?: string;
  utmDescription?: string;
  priority?: string;
};

export type LeadCommercialCore = {
  commercial: LeadCommercialDetailsData;
  source: string | null;
  estimatedAmount: number | null;
  probability: number | null;
};

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function trimToNull(value: string | null | undefined) {
  return value?.trim() || null;
}

function parseApiNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateOptionalString(value: unknown) {
  return value === undefined || typeof value === "string";
}

function validateOptionalNumber(value: unknown) {
  return value === undefined || value === null || typeof value === "number";
}

function invalidNonNegativeMoney(value: number | null | undefined) {
  return value !== undefined && value !== null && (
    !Number.isFinite(value)
    || value < 0
    || value > 999_999_999_999.99
  );
}

function invalidPercent(value: number | null | undefined) {
  return value !== undefined && value !== null && (
    !Number.isFinite(value)
    || value < 0
    || value > 100
  );
}

export function validateLeadCommercialCore(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "Некорректный формат коммерческих параметров.";
  }
  const input = value as Partial<LeadCommercialCoreInput>;
  if (input.source !== null && typeof input.source !== "string") {
    return "Источник лида указан некорректно.";
  }
  const optionalStrings = [
    input.direction,
    input.sport,
    input.productCategory,
    input.productType,
    input.needDescription,
    input.sizeComment,
    input.plannedOrderDate,
    input.desiredReadyDate,
    input.eventDate,
    input.deliveryCity,
    input.deliveryAddress,
    input.deliveryMethod,
    input.deliveryComment,
    input.campaign,
    input.utmDescription,
    input.priority,
  ];
  if (optionalStrings.some((item) => !validateOptionalString(item))) {
    return "Одно из текстовых полей имеет некорректный формат.";
  }
  if (input.estimatedAmount === undefined) {
    return "Предполагаемая сумма не передана.";
  }
  const optionalNumbers = [
    input.estimatedQuantity,
    input.kitQuantity,
    input.preliminaryBudget,
    input.estimatedAmount,
    input.discountPercent,
    input.probability,
  ];
  if (optionalNumbers.some((item) => !validateOptionalNumber(item))) {
    return "Одно из числовых полей имеет некорректный формат.";
  }
  const limitedText: Array<[string | null | undefined, number]> = [
    [input.source, 150],
    [input.direction, 150],
    [input.sport, 150],
    [input.productCategory, 150],
    [input.productType, 150],
    [input.deliveryCity, 150],
    [input.deliveryAddress, 500],
    [input.deliveryMethod, 150],
    [input.campaign, 255],
    [input.priority, 20],
  ];
  if (limitedText.some(([fieldValue, limit]) => fieldValue !== null && fieldValue !== undefined && fieldValue.trim().length > limit)) {
    return "Одно из текстовых полей превышает допустимую длину.";
  }
  const longText: Array<[string | undefined, number]> = [
    [input.needDescription, 3000],
    [input.sizeComment, 3000],
    [input.deliveryComment, 3000],
    [input.utmDescription, 3000],
  ];
  if (longText.some(([fieldValue, limit]) => typeof fieldValue === "string" && fieldValue.length > limit)) {
    return "Одно из многострочных полей превышает допустимую длину.";
  }
  if (input.estimatedQuantity !== undefined && (
    !Number.isInteger(input.estimatedQuantity)
    || input.estimatedQuantity < 1
    || input.estimatedQuantity > 2_147_483_647
  )) {
    return "Количество должно быть целым числом от 1 до 2147483647.";
  }
  if (input.kitQuantity !== undefined && (
    !Number.isInteger(input.kitQuantity)
    || input.kitQuantity < 1
    || input.kitQuantity > 2_147_483_647
  )) {
    return "Количество комплектов должно быть целым числом от 1 до 2147483647.";
  }
  if (invalidNonNegativeMoney(input.preliminaryBudget) || invalidNonNegativeMoney(input.estimatedAmount)) {
    return "Сумма должна быть числом от 0 до 999999999999,99.";
  }
  if (invalidPercent(input.discountPercent) || invalidPercent(input.probability)) {
    return "Процент должен быть числом от 0 до 100.";
  }
  const dateFields = [input.plannedOrderDate, input.desiredReadyDate, input.eventDate];
  if (dateFields.some((item) => typeof item === "string" && item !== "" && !validDate(item))) {
    return "Дата указана некорректно.";
  }
  if (input.priority && !["low", "medium", "high", "urgent"].includes(input.priority)) {
    return "Приоритет указан некорректно.";
  }
  return undefined;
}

export function toApiLeadCommercialPayload(input: LeadCommercialCoreInput) {
  return {
    source: trimToNull(input.source),
    direction: trimToNull(input.direction),
    sport: trimToNull(input.sport),
    product_category: trimToNull(input.productCategory),
    product_type: trimToNull(input.productType),
    need_description: trimToNull(input.needDescription),
    estimated_quantity: input.estimatedQuantity ?? null,
    kit_quantity: input.kitQuantity ?? null,
    size_comment: trimToNull(input.sizeComment),
    preliminary_budget: input.preliminaryBudget ?? null,
    estimated_amount: input.estimatedAmount,
    discount_percent: input.discountPercent ?? null,
    probability: input.probability ?? null,
    planned_order_date: input.plannedOrderDate || null,
    desired_date: input.desiredReadyDate || null,
    event_date: input.eventDate || null,
    delivery_city: trimToNull(input.deliveryCity),
    delivery_address: trimToNull(input.deliveryAddress),
    delivery_method: trimToNull(input.deliveryMethod),
    delivery_comment: trimToNull(input.deliveryComment),
    campaign: trimToNull(input.campaign),
    utm_description: trimToNull(input.utmDescription),
    priority: trimToNull(input.priority),
  };
}

export function fromApiLeadCommercial(lead: ApiLeadCommercialFields): LeadCommercialCore {
  return {
    source: lead.source,
    estimatedAmount: parseApiNumber(lead.estimated_amount),
    probability: parseApiNumber(lead.probability),
    commercial: {
      direction: (lead.direction as LeadCommercialDetailsData["direction"] | null | undefined) ?? undefined,
      sport: (lead.sport as LeadCommercialDetailsData["sport"] | null) ?? undefined,
      productCategory: (lead.product_category as LeadCommercialDetailsData["productCategory"] | null) ?? undefined,
      productType: (lead.product_type as LeadCommercialDetailsData["productType"] | null | undefined) ?? undefined,
      needDescription: lead.need_description ?? undefined,
      estimatedQuantity: lead.estimated_quantity ?? undefined,
      kitQuantity: lead.kit_quantity ?? undefined,
      sizeComment: lead.size_comment ?? undefined,
      preliminaryBudget: parseApiNumber(lead.preliminary_budget) ?? undefined,
      discountPercent: parseApiNumber(lead.discount_percent) ?? undefined,
      plannedOrderDate: lead.planned_order_date ?? undefined,
      desiredReadyDate: lead.desired_date ?? undefined,
      eventDate: lead.event_date ?? undefined,
      deliveryCity: lead.delivery_city ?? lead.city ?? undefined,
      deliveryAddress: lead.delivery_address ?? undefined,
      deliveryMethod: (lead.delivery_method as LeadCommercialDetailsData["deliveryMethod"] | null | undefined) ?? undefined,
      deliveryComment: lead.delivery_comment ?? undefined,
      campaign: lead.campaign ?? undefined,
      utmDescription: lead.utm_description ?? undefined,
      priority: (lead.priority as LeadCommercialDetailsData["priority"] | null | undefined) ?? undefined,
    },
  };
}
