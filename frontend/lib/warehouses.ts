export type Warehouse = {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type WarehouseDraft = {
  name: string;
  code: string;
  is_active: boolean;
  is_default: boolean;
};

export type WarehouseListParams = {
  search?: string;
  active_only?: boolean;
  limit?: number;
  offset?: number;
};

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export function filterWarehouses(
  rows: Warehouse[],
  query: string,
): Warehouse[] {
  const needle = query.trim().toLocaleLowerCase("ru");
  if (!needle) return rows;
  return rows.filter(
    (row) =>
      row.name.toLocaleLowerCase("ru").includes(needle) ||
      row.code.toLocaleLowerCase("ru").includes(needle),
  );
}

export function validateWarehouseDraft(draft: WarehouseDraft): string | null {
  if (!draft.name.trim()) return "Укажите наименование";
  if (draft.name.trim().length > 255) {
    return "Наименование не длиннее 255 символов";
  }
  if (!draft.code.trim()) return "Укажите код";
  if (draft.code.trim().length > 64) return "Код не длиннее 64 символов";
  if (draft.is_default && !draft.is_active) {
    return "Склад по умолчанию должен быть активным";
  }
  return null;
}

export async function getWarehouses(
  params: WarehouseListParams = {},
): Promise<Warehouse[]> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.active_only != null) {
    query.set("active_only", String(params.active_only));
  }
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await fetch(`${apiBaseUrl()}/warehouses${suffix}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить склады (${response.status}).`);
  }
  return (await response.json()) as Warehouse[];
}
