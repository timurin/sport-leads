export type SewingOperation = {
  id: number;
  name: string;
  cost: string;
  created_at: string;
  updated_at: string;
};

export type SewingOperationCreateDraft = {
  name: string;
  cost: string;
};

export type SewingOperationListParams = {
  search?: string;
  limit?: number;
  offset?: number;
};

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

/** Display money from API Decimal JSON. */
export function formatSewingCost(value: string | number): string {
  const amount =
    typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(amount)) {
    return "0,00";
  }
  return amount.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Normalize user cost input to API decimal string, or null if invalid. */
export function parseSewingCostInput(raw: string): string | null {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount.toFixed(2);
}

export function validateSewingOperationDraft(
  draft: SewingOperationCreateDraft,
): string | null {
  if (!draft.name.trim()) {
    return "Укажите наименование операции";
  }
  if (draft.name.trim().length > 255) {
    return "Наименование не длиннее 255 символов";
  }
  if (parseSewingCostInput(draft.cost) == null) {
    return "Укажите стоимость (число ≥ 0)";
  }
  return null;
}

export function filterSewingOperations(
  operations: SewingOperation[],
  query: string,
): SewingOperation[] {
  const needle = query.trim().toLocaleLowerCase("ru");
  if (!needle) return operations;
  return operations.filter((row) =>
    row.name.toLocaleLowerCase("ru").includes(needle),
  );
}

export async function getSewingOperations(
  params: SewingOperationListParams = {},
): Promise<SewingOperation[]> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await fetch(`${apiBaseUrl()}/sewing-operations${suffix}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `Не удалось загрузить операции пошива (${response.status}).`,
    );
  }
  return (await response.json()) as SewingOperation[];
}
