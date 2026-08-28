export type SewingOperation = {
  id: number;
  name: string;
  description: string | null;
  folder_id: number | null;
  sort_order: number;
  work_center_ids: number[];
  created_at: string;
  updated_at: string;
};

export type SewingOperationFolder = {
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SewingOperationCreateDraft = {
  name: string;
  description: string;
  folder_id: number | null;
  work_center_ids: number[];
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

/** Normalize quantity-per-item input (integer ≥ 1), or null if invalid. */
export function parseQuantityPerItemInput(raw: string): number | null {
  const normalized = String(raw ?? "")
    .trim()
    .replace(/[\s\u00a0\u202f]/g, "");
  if (!normalized) return null;
  if (!/^\d+$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value < 1) return null;
  return value;
}

/** Стоимость × количество операций на 1 изделие. */
export function sewingOperationLineTotal(
  cost: string | number,
  quantityPerItem: string | number | null | undefined,
): number {
  const amount =
    typeof cost === "number" ? cost : Number(String(cost).replace(",", "."));
  const qtyRaw =
    typeof quantityPerItem === "number"
      ? quantityPerItem
      : Number(String(quantityPerItem ?? "1").replace(",", "."));
  const qty =
    Number.isSafeInteger(qtyRaw) && qtyRaw >= 1 ? Math.floor(qtyRaw) : 1;
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return amount * qty;
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

export const SEWING_OPERATION_DESCRIPTION_MAX = 256;

export function validateSewingOperationDraft(
  draft: SewingOperationCreateDraft,
): string | null {
  if (!draft.name.trim()) {
    return "Укажите наименование операции";
  }
  if (draft.name.trim().length > 255) {
    return "Наименование не длиннее 255 символов";
  }
  if (draft.description.trim().length > SEWING_OPERATION_DESCRIPTION_MAX) {
    return `Описание не длиннее ${SEWING_OPERATION_DESCRIPTION_MAX} символов`;
  }
  return null;
}

/** Unique catalog name for an operation copy (`Name (копия)`, `Name (копия 2)`, …). */
export function nextSewingOperationCopyName(
  sourceName: string,
  existingNames: Iterable<string>,
): string {
  const taken = new Set(
    [...existingNames].map((name) => name.trim().toLocaleLowerCase("ru")),
  );
  const base = sourceName.trim() || "Операция";
  const first = `${base} (копия)`;
  if (!taken.has(first.toLocaleLowerCase("ru"))) return first;
  let suffix = 2;
  while (suffix < 10_000) {
    const candidate = `${base} (копия ${suffix})`;
    if (!taken.has(candidate.toLocaleLowerCase("ru"))) return candidate;
    suffix += 1;
  }
  return `${base} (копия ${Date.now()})`;
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

/** Toggle id in multi-select list (order preserved for existing ids). */
export function toggleSewingWorkCenterId(
  selectedIds: number[],
  workCenterId: number,
): number[] {
  if (selectedIds.includes(workCenterId)) {
    return selectedIds.filter((id) => id !== workCenterId);
  }
  return [...selectedIds, workCenterId];
}

/** Labels for linked sewing-shop equipment (цех Пошив). */
export function formatSewingEquipmentLabels(
  workCenterIds: number[],
  catalog: ReadonlyArray<{ id: number; name: string; code?: string }>,
): string {
  if (!workCenterIds.length) return "—";
  const byId = new Map(catalog.map((row) => [row.id, row]));
  return workCenterIds
    .map((id) => {
      const row = byId.get(id);
      if (row == null) return `#${id}`;
      return row.code ? `${row.name} (${row.code})` : row.name;
    })
    .join(", ");
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
  const rows = (await response.json()) as SewingOperation[];
  return rows.map((row) => ({
    ...row,
    folder_id:
      row.folder_id == null || Number(row.folder_id) <= 0
        ? null
        : Number(row.folder_id),
    sort_order: Number(row.sort_order ?? 0) || 0,
    work_center_ids: Array.isArray(row.work_center_ids)
      ? row.work_center_ids
          .map((id) => Number(id))
          .filter((id) => Number.isSafeInteger(id) && id > 0)
      : [],
  }));
}

export async function getSewingOperationFolders(): Promise<
  SewingOperationFolder[]
> {
  const response = await fetch(`${apiBaseUrl()}/sewing-operation-folders`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `Не удалось загрузить папки операций пошива (${response.status}).`,
    );
  }
  const rows = (await response.json()) as SewingOperationFolder[];
  return rows.map((row) => ({
    ...row,
    parent_id:
      row.parent_id == null || Number(row.parent_id) <= 0
        ? null
        : Number(row.parent_id),
    sort_order: Number(row.sort_order ?? 0) || 0,
  }));
}

export type SewingCatalogTreeRow =
  | {
      kind: "folder";
      id: number;
      name: string;
      parent_id: number | null;
      sort_order: number;
      depth: number;
      folder: SewingOperationFolder;
    }
  | {
      kind: "operation";
      id: number;
      name: string;
      parent_id: number | null;
      sort_order: number;
      depth: number;
      operation: SewingOperation;
    };

/** Build depth-first catalog rows: folders then ops under each parent. */
export function buildSewingCatalogTreeRows(
  folders: SewingOperationFolder[],
  operations: SewingOperation[],
): SewingCatalogTreeRow[] {
  const childrenOf = new Map<number | null, SewingOperationFolder[]>();
  for (const folder of folders) {
    const key = folder.parent_id;
    const list = childrenOf.get(key) ?? [];
    list.push(folder);
    childrenOf.set(key, list);
  }
  for (const list of childrenOf.values()) {
    list.sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        a.name.localeCompare(b.name, "ru") ||
        a.id - b.id,
    );
  }

  const opsOf = new Map<number | null, SewingOperation[]>();
  for (const op of operations) {
    const key = op.folder_id;
    const list = opsOf.get(key) ?? [];
    list.push(op);
    opsOf.set(key, list);
  }
  for (const list of opsOf.values()) {
    list.sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        a.name.localeCompare(b.name, "ru") ||
        a.id - b.id,
    );
  }

  const rows: SewingCatalogTreeRow[] = [];

  const walk = (parentId: number | null, depth: number) => {
    for (const folder of childrenOf.get(parentId) ?? []) {
      rows.push({
        kind: "folder",
        id: folder.id,
        name: folder.name,
        parent_id: folder.parent_id,
        sort_order: folder.sort_order,
        depth,
        folder,
      });
      walk(folder.id, depth + 1);
    }
    for (const operation of opsOf.get(parentId) ?? []) {
      rows.push({
        kind: "operation",
        id: operation.id,
        name: operation.name,
        parent_id: operation.folder_id,
        sort_order: operation.sort_order,
        depth,
        operation,
      });
    }
  };

  walk(null, 0);
  return rows;
}

export function visibleSewingCatalogTreeRows(
  rows: SewingCatalogTreeRow[],
  expandedFolderIds: Set<number>,
): SewingCatalogTreeRow[] {
  const visible: SewingCatalogTreeRow[] = [];
  const collapsedSubtree = new Set<number>();

  for (const row of rows) {
    if (row.parent_id != null && collapsedSubtree.has(row.parent_id)) {
      if (row.kind === "folder") collapsedSubtree.add(row.id);
      continue;
    }
    visible.push(row);
    if (row.kind === "folder" && !expandedFolderIds.has(row.id)) {
      collapsedSubtree.add(row.id);
    }
  }
  return visible;
}
