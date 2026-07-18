export type LeadConversionDraft = {
  title: string;
  description: string;
  productCategory: string;
  sport: string;
  quantity: number;
  amount: number;
  desiredDate: string;
};

export function toLeadConversionPayload(draft: LeadConversionDraft) {
  return {
    title: draft.title,
    description: draft.description,
    product_category: draft.productCategory,
    sport: draft.sport,
    quantity: draft.quantity,
    amount: draft.amount,
    desired_date: draft.desiredDate,
  };
}
