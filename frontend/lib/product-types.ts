export type ProductType = {
  id: number;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProductTypeDraft = {
  name: string;
  is_active: boolean;
  sort_order: string;
};

export type ProductTypeListParams = {
  search?: string;
  is_active?: boolean;
  limit?: number;
  offset?: number;
};

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export function validateProductTypeDraft(
  draft: ProductTypeDraft,
): string | null {
  if (!draft.name.trim()) {
    return "Укажите наименование типа изделия";
  }
  if (draft.name.trim().length > 255) {
    return "Наименование не длиннее 255 символов";
  }
  const sortRaw = draft.sort_order.trim();
  if (!sortRaw) {
    return "Укажите порядок сортировки";
  }
  if (!/^\d+$/.test(sortRaw)) {
    return "Порядок сортировки — целое число ≥ 0";
  }
  return null;
}

export function parseSortOrder(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

export function filterProductTypes(
  rows: ProductType[],
  query: string,
): ProductType[] {
  const needle = query.trim().toLocaleLowerCase("ru");
  if (!needle) return rows;
  return rows.filter((row) =>
    row.name.toLocaleLowerCase("ru").includes(needle),
  );
}

export async function getProductTypes(
  params: ProductTypeListParams = {},
): Promise<ProductType[]> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.is_active != null) query.set("is_active", String(params.is_active));
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await fetch(`${apiBaseUrl()}/product-types${suffix}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `Не удалось загрузить типы изделий (${response.status}).`,
    );
  }
  return (await response.json()) as ProductType[];
}
