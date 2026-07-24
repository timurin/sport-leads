export type ApiNomenclature = {
  id: number;
  name: string;
  short_name: string | null;
  description: string | null;
  category: string;
  category_id: number | null;
  storage_unit_id: number | null;
  nomenclature_type: NomenclatureType;
  product_type_id: number | null;
  product_type_name?: string | null;
  unit: string;
  base_price: number | string;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type NomenclatureType = "SERVICE" | "PRODUCT" | "GOODS" | "MATERIAL";

export type ApiNomenclatureCategory = {
  id: number;
  parent_id: number | null;
  name: string;
  code: string;
  description: string | null;
  nomenclature_type: NomenclatureType;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type NomenclatureCategory = ApiNomenclatureCategory;

export type Nomenclature = ApiNomenclature & { basePrice: string };

export const NOMENCLATURE_TYPE_LABELS: Record<NomenclatureType, string> = {
  SERVICE: "Услуга",
  PRODUCT: "Продукция",
  GOODS: "Товар",
  MATERIAL: "Материал",
};

export const NOMENCLATURE_TYPE_OPTIONS = Object.entries(
  NOMENCLATURE_TYPE_LABELS,
) as [NomenclatureType, string][];

export const NOMENCLATURE_CURRENCY_OPTIONS = ["RUB", "USD", "EUR"] as const;

export const NOMENCLATURE_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const NOMENCLATURE_IMAGE_RULE =
  "Только JPEG / PNG / WebP, не больше 10 МБ.";

/** Core card requisites draft — maps 1:1 to backend Nomenclature fields. */
export type NomenclatureRequisitesDraft = {
  name: string;
  short_name: string;
  description: string;
  category_id: number | null;
  storage_unit_id: number | null;
  nomenclature_type: NomenclatureType;
  product_type_id: number | null;
  base_price: string;
  currency: string;
  is_active: boolean;
};

export function nomenclatureStatusTone(
  isActive: boolean,
): "success" | "neutral" {
  return isActive ? "success" : "neutral";
}

export function nomenclatureStatusLabel(isActive: boolean): string {
  return isActive ? "Активна" : "Архив";
}

export function categoryPathLabel(
  categoryId: number | null,
  categories: NomenclatureCategory[],
): string {
  const category = categories.find((item) => item.id === categoryId);
  if (!category) return "Без категории";
  const parent = category.parent_id
    ? `${categoryPathLabel(category.parent_id, categories)} / `
    : "";
  return `${parent}${category.name}`;
}

/**
 * Resolve `category_id` from catalog. Prefer explicit id; otherwise match
 * legacy `category` name. Type is not a hard filter (ADR-006 / 4.9.1); when
 * several names collide, prefer active then same nomenclature type.
 */
export function resolveNomenclatureCategoryId(
  categoryId: number | null,
  categoryLabel: string,
  categories: NomenclatureCategory[],
  nomenclatureType: NomenclatureType,
): number | null {
  if (categoryId != null) {
    const byId = categories.find((row) => row.id === categoryId);
    if (byId) return byId.id;
  }
  const needle = categoryLabel.trim().toLocaleLowerCase("ru");
  if (!needle || needle === "без категории") return null;
  const matches = categories
    .filter((row) => row.name.toLocaleLowerCase("ru") === needle)
    .sort((left, right) => {
      if (left.is_active !== right.is_active) {
        return left.is_active ? -1 : 1;
      }
      const leftType = left.nomenclature_type === nomenclatureType ? 0 : 1;
      const rightType = right.nomenclature_type === nomenclatureType ? 0 : 1;
      if (leftType !== rightType) {
        return leftType - rightType;
      }
      return left.id - right.id;
    });
  return matches[0]?.id ?? null;
}

/** Display label for card: path from id, else legacy string, else «Без категории». */
export function categoryDisplayLabel(
  categoryId: number | null,
  categories: NomenclatureCategory[],
  fallback = "",
): string {
  if (categoryId != null) {
    const path = categoryPathLabel(categoryId, categories);
    if (path !== "Без категории") return path;
  }
  const trimmed = fallback.trim();
  return trimmed || "Без категории";
}

/** Legacy `category` string for PATCH — derived from `category_id`, never free-typed. */
export function resolveNomenclatureCategoryLabel(
  categoryId: number | null,
  categories: NomenclatureCategory[],
  fallback: string,
): string {
  if (categoryId == null) {
    const trimmed = fallback.trim();
    return trimmed || "Без категории";
  }
  const category = categories.find((item) => item.id === categoryId);
  return category?.name ?? (fallback.trim() || "Без категории");
}

/** Legacy `unit` string for PATCH — derived from `storage_unit_id`. */
export function resolveNomenclatureUnitSymbol(
  storageUnitId: number | null,
  units: UnitOfMeasure[],
  fallback: string,
): string {
  if (storageUnitId == null) {
    const trimmed = fallback.trim();
    return trimmed || "шт";
  }
  const unit = units.find((item) => item.id === storageUnitId);
  return unit?.symbol ?? (fallback.trim() || "шт");
}

export function toNomenclatureRequisitesDraft(
  item: Nomenclature,
  categories: NomenclatureCategory[] = [],
): NomenclatureRequisitesDraft {
  return {
    name: item.name,
    short_name: item.short_name ?? "",
    description: item.description ?? "",
    category_id: resolveNomenclatureCategoryId(
      item.category_id,
      item.category,
      categories,
      item.nomenclature_type,
    ),
    storage_unit_id: item.storage_unit_id,
    nomenclature_type: item.nomenclature_type,
    product_type_id: item.product_type_id ?? null,
    base_price: item.basePrice,
    currency: item.currency,
    is_active: item.is_active,
  };
}

export function isNomenclatureRequisitesDirty(
  item: Nomenclature,
  draft: NomenclatureRequisitesDraft,
): boolean {
  return (
    draft.name !== item.name ||
    draft.short_name !== (item.short_name ?? "") ||
    draft.description !== (item.description ?? "") ||
    draft.category_id !== item.category_id ||
    draft.storage_unit_id !== item.storage_unit_id ||
    draft.nomenclature_type !== item.nomenclature_type ||
    draft.product_type_id !== (item.product_type_id ?? null) ||
    draft.base_price !== item.basePrice ||
    draft.currency !== item.currency ||
    draft.is_active !== item.is_active
  );
}

export function validateNomenclatureRequisitesDraft(
  draft: NomenclatureRequisitesDraft,
): string | null {
  if (!draft.name.trim()) return "Укажите наименование";
  if (draft.name.trim().length > 255) {
    return "Наименование не длиннее 255 символов";
  }
  if (draft.short_name.trim().length > 100) {
    return "Наименование для печати не длиннее 100 символов";
  }
  const price = Number(draft.base_price);
  if (!Number.isFinite(price) || price < 0) {
    return "Укажите корректную цену без НДС";
  }
  if (!/^[A-Z]{3}$/.test(draft.currency.trim())) {
    return "Валюта должна быть кодом из 3 латинских букв";
  }
  return null;
}

export function validateNomenclatureImageFile(file: File): string | null {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) return NOMENCLATURE_IMAGE_RULE;
  if (file.size > 10 * 1024 * 1024) return NOMENCLATURE_IMAGE_RULE;
  return null;
}

export function nomenclatureMediaUrl(contentUrl: string): string {
  if (
    contentUrl.startsWith("http://") ||
    contentUrl.startsWith("https://") ||
    contentUrl.startsWith("blob:")
  ) {
    return contentUrl;
  }
  const base = (
    process.env.NEXT_PUBLIC_SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
  return `${base}${contentUrl.startsWith("/") ? contentUrl : `/${contentUrl}`}`;
}

export type UnitCategory = "QUANTITY" | "LENGTH" | "AREA" | "MASS" | "TIME" | "SERVICE";
export type UnitOfMeasure = {
  id: number; code: string; name: string; symbol: string; unit_category: UnitCategory;
  precision: number; is_active: boolean; is_system: boolean; created_at: string; updated_at: string;
};

export type CharacteristicKind =
  | "STRING"
  | "TEXT"
  | "INTEGER"
  | "DECIMAL"
  | "BOOLEAN"
  | "DATE"
  | "LIST"
  | "MULTI_SELECT"
  | "COLOR";

export type CharacteristicDefinition = {
  id: number;
  code: string;
  name: string;
  kind: CharacteristicKind;
  description: string | null;
  unit_id: number | null;
  is_variant_dimension: boolean;
  is_searchable: boolean;
  is_filterable: boolean;
  is_visible: boolean;
  is_active: boolean;
  is_system: boolean;
  can_delete?: boolean;
  created_at: string;
  updated_at: string;
};

export type CharacteristicOption = {
  id: number;
  characteristic_id: number;
  code: string;
  label: string;
  hex_value: string | null;
  sort_order: number;
  is_active: boolean;
  can_delete?: boolean;
  created_at: string;
  updated_at: string;
};

export type CategoryCharacteristic = {
  id: number;
  category_id: number;
  characteristic_id: number;
  is_required: boolean;
  inherit: boolean;
  is_visible: boolean;
  sort_order: number;
  default_value: unknown;
  inherited: boolean;
  source_category_id: number;
  created_at: string;
  updated_at: string;
};

export type NomenclatureCharacteristic = {
  id: number;
  nomenclature_id: number;
  characteristic_id: number;
  created_at: string;
  updated_at: string;
};

export type NomenclatureCharacteristicValue = {
  characteristic_id: number;
  code: string;
  name: string;
  kind: CharacteristicKind;
  value: unknown;
  default_value: unknown;
  is_required: boolean;
  is_visible: boolean;
  inherited: boolean;
  source_category_id: number | null;
};

export type NomenclatureVariant = {
  id: number;
  nomenclature_id: number;
  article: string;
  name: string;
  is_active: boolean;
  option_ids: number[];
  options: CharacteristicOption[];
  created_at: string;
  updated_at: string;
};

export type NomenclatureMedia = {
  id: number;
  nomenclature_id: number;
  filename: string;
  mime_type: string;
  file_size: number;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  content_url: string;
};

export function fromApiNomenclature(item: ApiNomenclature): Nomenclature {
  return {
    ...item,
    product_type_id: item.product_type_id ?? null,
    basePrice: Number(item.base_price).toFixed(2),
  };
}

export function nomenclatureLabel(item: Nomenclature): string {
  return item.name;
}

export async function getNomenclature(): Promise<Nomenclature[]> {
  const apiUrl = (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  const response = await fetch(`${apiUrl}/nomenclatures`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Не удалось загрузить номенклатуру (${response.status}).`);
  return (await response.json() as ApiNomenclature[]).map(fromApiNomenclature);
}

export async function getNomenclatureById(
  nomenclatureId: number,
): Promise<Nomenclature | null> {
  const apiUrl = (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  const response = await fetch(`${apiUrl}/nomenclatures/${nomenclatureId}`, {
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(
      `Не удалось загрузить карточку номенклатуры (${response.status}).`,
    );
  }
  return fromApiNomenclature((await response.json()) as ApiNomenclature);
}

export async function getNomenclatureCategories(): Promise<NomenclatureCategory[]> {
  const apiUrl = (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  const response = await fetch(`${apiUrl}/nomenclatures/categories`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Не удалось загрузить категории номенклатуры (${response.status}).`);
  return await response.json() as NomenclatureCategory[];
}

export async function getUnitsOfMeasure(): Promise<UnitOfMeasure[]> {
  const apiUrl = (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  const response = await fetch(`${apiUrl}/nomenclatures/units-of-measure`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Не удалось загрузить единицы измерения (${response.status}).`);
  return await response.json() as UnitOfMeasure[];
}

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

export function characteristicsApiPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized === "/characteristics" ||
    normalized.startsWith("/characteristics/")
    ? normalized
    : `/characteristics${normalized}`;
}

async function getCharacteristicApi<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${characteristicsApiPath(path)}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить характеристики (${response.status}).`);
  }
  return (await response.json()) as T;
}

export async function getCharacteristicDefinitions(): Promise<CharacteristicDefinition[]> {
  return getCharacteristicApi<CharacteristicDefinition[]>("/definitions");
}

export async function getCategoryCharacteristics(
  id: number,
): Promise<CategoryCharacteristic[]> {
  return getCharacteristicApi<CategoryCharacteristic[]>(`/categories/${id}`);
}

export async function getNomenclatureCharacteristics(
  id: number,
): Promise<NomenclatureCharacteristic[]> {
  return getCharacteristicApi<NomenclatureCharacteristic[]>(
    `/nomenclatures/${id}`,
  );
}

export async function getNomenclatureVariants(
  id: number,
): Promise<NomenclatureVariant[]> {
  return getCharacteristicApi<NomenclatureVariant[]>(
    `/nomenclatures/${id}/variants`,
  );
}

export async function getCharacteristicOptions(
  id: number,
): Promise<CharacteristicOption[]> {
  return getCharacteristicApi<CharacteristicOption[]>(
    `/definitions/${id}/options`,
  );
}

export async function getCharacteristicUsedValues(
  id: number,
): Promise<string[]> {
  return getCharacteristicApi<string[]>(`/definitions/${id}/used-values`);
}

export async function getNomenclatureCharacteristicValues(
  nomenclatureId: number,
): Promise<NomenclatureCharacteristicValue[]> {
  return getCharacteristicApi<NomenclatureCharacteristicValue[]>(
    `/nomenclatures/${nomenclatureId}/values`,
  );
}

/** Exact active name match against the characteristics handbook. */
export function findCharacteristicByName<
  T extends { id: number; name: string; is_active: boolean },
>(definitions: T[], name: string): T | null {
  const needle = name.trim().toLocaleLowerCase("ru");
  if (!needle) return null;
  const matches = definitions
    .filter(
      (field) =>
        field.is_active && field.name.toLocaleLowerCase("ru") === needle,
    )
    .sort((left, right) => left.id - right.id);
  return matches[0] ?? null;
}

export async function getNomenclatureMedia(id: number): Promise<NomenclatureMedia[]> {
  const response = await fetch(`${apiBaseUrl()}/nomenclatures/${id}/media`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить media номенклатуры (${response.status}).`);
  }
  return (await response.json()) as NomenclatureMedia[];
}

export type NomenclatureAvailableModel = {
  id: number;
  nomenclature_id: number;
  product_model_id: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  article: string;
  name: string;
  size_type: "men" | "women" | "kids";
  status: "draft" | "active" | "archived";
};

export async function getNomenclatureAvailableModels(
  nomenclatureId: number,
): Promise<NomenclatureAvailableModel[]> {
  const response = await fetch(
    `${apiBaseUrl()}/nomenclatures/${nomenclatureId}/available-models`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    if (response.status === 422) {
      return [];
    }
    throw new Error(
      `Не удалось загрузить доступные модели лекал (${response.status}).`,
    );
  }
  return (await response.json()) as NomenclatureAvailableModel[];
}
