export type TechOperationVolumeUnit = "linear_meters" | "pieces";

export type TechOperation = {
  id: number;
  name: string;
  code: string;
  volume_unit: TechOperationVolumeUnit;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TechOperationDraft = {
  name: string;
  code: string;
  volume_unit: TechOperationVolumeUnit;
  is_active: boolean;
};

export type TechOperationListParams = {
  search?: string;
  active_only?: boolean;
  limit?: number;
  offset?: number;
};

export const TECH_OPERATION_VOLUME_UNIT_LABELS: Record<
  TechOperationVolumeUnit,
  string
> = {
  linear_meters: "м.п.",
  pieces: "шт.",
};

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export function formatTechOperationVolumeUnit(
  unit: TechOperationVolumeUnit,
): string {
  return TECH_OPERATION_VOLUME_UNIT_LABELS[unit] ?? unit;
}

export function validateTechOperationDraft(
  draft: TechOperationDraft,
): string | null {
  if (!draft.name.trim()) {
    return "Укажите наименование операции";
  }
  if (draft.name.trim().length > 255) {
    return "Наименование не длиннее 255 символов";
  }
  if (!draft.code.trim()) {
    return "Укажите код операции";
  }
  if (draft.code.trim().length > 64) {
    return "Код не длиннее 64 символов";
  }
  if (draft.volume_unit !== "linear_meters" && draft.volume_unit !== "pieces") {
    return "Выберите единицу объёма";
  }
  return null;
}

export function filterTechOperations(
  operations: TechOperation[],
  query: string,
): TechOperation[] {
  const needle = query.trim().toLocaleLowerCase("ru");
  if (!needle) return operations;
  return operations.filter(
    (row) =>
      row.name.toLocaleLowerCase("ru").includes(needle) ||
      row.code.toLocaleLowerCase("ru").includes(needle),
  );
}

export async function getTechOperations(
  params: TechOperationListParams = {},
): Promise<TechOperation[]> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.active_only != null) {
    query.set("active_only", String(params.active_only));
  }
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await fetch(`${apiBaseUrl()}/tech-operations${suffix}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `Не удалось загрузить технологические операции (${response.status}).`,
    );
  }
  return (await response.json()) as TechOperation[];
}
