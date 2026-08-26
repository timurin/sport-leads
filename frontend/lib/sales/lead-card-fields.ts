export type LeadCardFieldBlock = "customer" | "interest" | "delivery" | "metrics";

export type LeadCardField = {
  id: number;
  block: LeadCardFieldBlock;
  label: string;
  sortOrder: number;
  value: string;
};

export type ApiLeadCardFieldValue = {
  definition_id: number;
  block: LeadCardFieldBlock;
  label: string;
  sort_order: number;
  value: string;
};

export function fromApiLeadCardFieldValue(row: ApiLeadCardFieldValue): LeadCardField {
  return {
    id: row.definition_id,
    block: row.block,
    label: row.label,
    sortOrder: row.sort_order,
    value: row.value ?? "",
  };
}

export function fieldsForBlock(
  fields: readonly LeadCardField[],
  block: LeadCardFieldBlock,
): LeadCardField[] {
  return fields
    .filter((field) => field.block === block)
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id);
}
