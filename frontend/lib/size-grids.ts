export type SizeGridSizeType = "men" | "women" | "kids";

export type SizeGridListItem = {
  id: number;
  name: string;
  size_type: SizeGridSizeType;
  source_note: string | null;
  row_count: number;
  created_at: string;
  updated_at: string;
};

export type SizeGridRow = {
  id: number;
  sort_order: number;
  ru_size: string;
  int_label: string;
  chest: string;
  waist: string;
  hip: string;
  height_s: string | null;
  height_n: string | null;
  height_t: string | null;
};

export type SizeGrid = {
  id: number;
  name: string;
  size_type: SizeGridSizeType;
  source_note: string | null;
  created_at: string;
  updated_at: string;
  rows: SizeGridRow[];
};

export const SIZE_GRID_SIZE_TYPE_LABELS: Record<SizeGridSizeType, string> = {
  men: "Мужской",
  women: "Женский",
  kids: "Детский",
};

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export function formatHeightLabel(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

export function filterSizeGrids(
  grids: SizeGridListItem[],
  query: string,
  sizeType: SizeGridSizeType | "all",
): SizeGridListItem[] {
  const needle = query.trim().toLocaleLowerCase("ru");
  return grids.filter((grid) => {
    if (sizeType !== "all" && grid.size_type !== sizeType) return false;
    if (!needle) return true;
    return (
      grid.name.toLocaleLowerCase("ru").includes(needle) ||
      SIZE_GRID_SIZE_TYPE_LABELS[grid.size_type]
        .toLocaleLowerCase("ru")
        .includes(needle)
    );
  });
}

export function parseSizeGridRouteId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function getSizeGrids(params?: {
  size_type?: SizeGridSizeType;
}): Promise<SizeGridListItem[]> {
  const query = new URLSearchParams();
  if (params?.size_type) query.set("size_type", params.size_type);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await fetch(`${apiBaseUrl()}/size-grids${suffix}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить размерные сетки (${response.status})`);
  }
  return (await response.json()) as SizeGridListItem[];
}

export async function getSizeGrid(gridId: number): Promise<SizeGrid | null> {
  const response = await fetch(`${apiBaseUrl()}/size-grids/${gridId}`, {
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Не удалось загрузить размерную сетку (${response.status})`);
  }
  return (await response.json()) as SizeGrid;
}
