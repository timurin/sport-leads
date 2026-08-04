/**
 * Platform directories (Stage 18.2).
 */

export type PlatformDirectoryStatus = "planned" | "live" | "deprecated";

export type PlatformDirectoryRegistryItem = {
  code: string;
  title: string;
  description: string;
  list_path: string;
  api_prefix: string;
  status: PlatformDirectoryStatus | string;
};

export type PlatformCity = {
  id: number;
  name: string;
  region: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PlatformCityDraft = {
  name: string;
  region: string;
  is_active: boolean;
  sort_order: number;
};

export function emptyPlatformCityDraft(): PlatformCityDraft {
  return {
    name: "",
    region: "",
    is_active: true,
    sort_order: 0,
  };
}

export function cityToDraft(city: PlatformCity): PlatformCityDraft {
  return {
    name: city.name,
    region: city.region ?? "",
    is_active: city.is_active,
    sort_order: city.sort_order,
  };
}

export function filterPlatformCities(
  rows: PlatformCity[],
  query: string,
  activeOnly: boolean,
): PlatformCity[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (activeOnly && !row.is_active) return false;
    if (!needle) return true;
    return (
      row.name.toLowerCase().includes(needle) ||
      (row.region ?? "").toLowerCase().includes(needle)
    );
  });
}

export function validatePlatformCityDraft(
  draft: PlatformCityDraft,
): string | null {
  if (!draft.name.trim()) return "Укажите название города";
  if (draft.name.trim().length > 120) {
    return "Название не длиннее 120 символов";
  }
  if (draft.region.trim().length > 120) {
    return "Регион не длиннее 120 символов";
  }
  return null;
}
