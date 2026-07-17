import type { LeadCommercialDetailsData } from "@/types/sales";

export type ApiLeadCommercialFields = {
  source: string | null;
  sport: string | null;
  product_category: string | null;
  need_description: string | null;
  estimated_quantity: number | null;
  estimated_amount: number | string | null;
  desired_date: string | null;
  city: string | null;
};

export type LeadCommercialCoreInput = {
  source: string | null;
  sport?: string;
  productCategory?: string;
  needDescription?: string;
  estimatedQuantity?: number;
  estimatedAmount: number | null;
  desiredReadyDate?: string;
  deliveryCity?: string;
};

export type LeadCommercialCore = {
  commercial: LeadCommercialDetailsData;
  source: string | null;
  estimatedAmount: number | null;
};

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
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
    input.sport,
    input.productCategory,
    input.needDescription,
    input.desiredReadyDate,
    input.deliveryCity,
  ];
  if (optionalStrings.some((item) => item !== undefined && typeof item !== "string")) {
    return "Одно из текстовых полей имеет некорректный формат.";
  }
  if (input.estimatedAmount === undefined) {
    return "Предполагаемая сумма не передана.";
  }
  const limitedText: Array<[string | null | undefined, number]> = [
    [input.source, 150],
    [input.sport, 150],
    [input.productCategory, 150],
    [input.deliveryCity, 150],
  ];
  if (limitedText.some(([value, limit]) => value !== null && value !== undefined && value.trim().length > limit)) {
    return "Одно из текстовых полей превышает допустимую длину.";
  }
  if (typeof input.needDescription === "string" && input.needDescription.length > 3000) {
    return "Описание потребности превышает 3000 символов.";
  }
  if (input.estimatedQuantity !== undefined && (
    !Number.isInteger(input.estimatedQuantity)
    || input.estimatedQuantity < 1
    || input.estimatedQuantity > 2_147_483_647
  )) {
    return "Количество должно быть целым числом от 1 до 2147483647.";
  }
  if (input.estimatedAmount !== null && (
    !Number.isFinite(input.estimatedAmount)
    || input.estimatedAmount < 0
    || input.estimatedAmount > 999_999_999_999.99
  )) {
    return "Сумма должна быть числом от 0 до 999999999999,99.";
  }
  if (typeof input.desiredReadyDate === "string" && !validDate(input.desiredReadyDate)) {
    return "Дата готовности указана некорректно.";
  }
  return undefined;
}

export function toApiLeadCommercialPayload(input: LeadCommercialCoreInput) {
  return {
    source: input.source?.trim() || null,
    sport: input.sport?.trim() || null,
    product_category: input.productCategory?.trim() || null,
    need_description: input.needDescription?.trim() || null,
    estimated_quantity: input.estimatedQuantity ?? null,
    estimated_amount: input.estimatedAmount,
    desired_date: input.desiredReadyDate || null,
    city: input.deliveryCity?.trim() || null,
  };
}

export function fromApiLeadCommercial(lead: ApiLeadCommercialFields): LeadCommercialCore {
  return {
    source: lead.source,
    estimatedAmount: lead.estimated_amount === null ? null : Number(lead.estimated_amount),
    commercial: {
      sport: lead.sport as LeadCommercialDetailsData["sport"] ?? undefined,
      productCategory: lead.product_category as LeadCommercialDetailsData["productCategory"] ?? undefined,
      needDescription: lead.need_description ?? undefined,
      estimatedQuantity: lead.estimated_quantity ?? undefined,
      desiredReadyDate: lead.desired_date ?? undefined,
      deliveryCity: lead.city ?? undefined,
    },
  };
}
