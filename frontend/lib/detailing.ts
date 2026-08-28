export type DetailingProductTypeEmbed = {
  id: number;
  name: string;
};

export type DetailingItem = {
  id: number;
  name: string;
  applicability_product_types: DetailingProductTypeEmbed[];
  created_at: string;
  updated_at: string;
};

export type DetailingItemDraft = {
  name: string;
  applicability_product_type_ids: number[];
};

export type DetailingListParams = {
  search?: string;
  product_type_id?: number;
  limit?: number;
  offset?: number;
};

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export function detailingApplicabilityLabel(item: DetailingItem): string {
  const names = item.applicability_product_types.map((row) => row.name).filter(Boolean);
  return names.length > 0 ? names.join(", ") : "—";
}

export function validateDetailingDraft(draft: DetailingItemDraft): string | null {
  if (!draft.name.trim()) return "Укажите наименование";
  if (draft.name.trim().length > 255) return "Наименование не длиннее 255 символов";
  if (draft.applicability_product_type_ids.length === 0) {
    return "Выберите хотя бы один вид изделия (применимость)";
  }
  return null;
}

export async function getDetailingItems(
  params: DetailingListParams = {},
): Promise<DetailingItem[]> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.product_type_id != null) {
    query.set("product_type_id", String(params.product_type_id));
  }
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await fetch(`${apiBaseUrl()}/detailing-items${suffix}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить деталировку (${response.status})`);
  }
  return (await response.json()) as DetailingItem[];
}
