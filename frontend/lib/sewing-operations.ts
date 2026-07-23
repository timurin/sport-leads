export type SewingOperation = {
  id: number;
  name: string;
  cost: string;
  duration_seconds: number;
  created_at: string;
  updated_at: string;
};

export type SewingOperationCreateDraft = {
  name: string;
  cost: string;
  duration_seconds: string;
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

/** ASCII cost string for edit inputs (avoids locale NBSP from formatSewingCost). */
export function toSewingCostInput(value: string | number | null | undefined): string {
  if (value == null || value === "") return "0.00";
  const amount =
    typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0) return "0.00";
  return amount.toFixed(2);
}

/** Normalize user cost input to API decimal string, or null if invalid. */
export function parseSewingCostInput(raw: string): string | null {
  const normalized = String(raw ?? "")
    .trim()
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(",", ".");
  if (!normalized) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount.toFixed(2);
}

/** Normalize duration (seconds) input, or null if invalid. */
export function parseDurationSecondsInput(raw: string): number | null {
  const normalized = String(raw ?? "")
    .trim()
    .replace(/[\s\u00a0\u202f]/g, "");
  if (!normalized) return null;
  if (!/^\d+$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

/** «XX минут XX секунд» from total seconds. */
export function formatDurationMinutesSeconds(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes} ${pluralRu(minutes, "минута", "минуты", "минут")} ${seconds} ${pluralRu(seconds, "секунда", "секунды", "секунд")}`;
}

/** Compact line label, e.g. `125 с`. */
export function formatDurationSecondsLabel(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  return `${sec} с`;
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
  if (parseDurationSecondsInput(draft.duration_seconds) == null) {
    return "Укажите время выполнения в секундах (целое ≥ 0)";
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
