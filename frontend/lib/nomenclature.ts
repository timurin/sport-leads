export type ApiNomenclature = {
  id: number;
  article: string;
  name: string;
  short_name: string | null;
  description: string | null;
  category: string;
  category_id: number | null;
  storage_unit_id: number | null;
  nomenclature_type: NomenclatureType;
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

export type UnitCategory = "QUANTITY" | "LENGTH" | "AREA" | "MASS" | "TIME" | "SERVICE";
export type UnitOfMeasure = {
  id: number; code: string; name: string; symbol: string; unit_category: UnitCategory;
  precision: number; is_active: boolean; is_system: boolean; created_at: string; updated_at: string;
};

export type CustomFieldDataType = "STRING" | "TEXT" | "INTEGER" | "DECIMAL" | "BOOLEAN" | "DATE" | "SINGLE_SELECT" | "MULTI_SELECT" | "COLOR";
export type CustomFieldDefinition = { id: number; code: string; name: string; description: string | null; data_type: CustomFieldDataType; unit_id: number | null; is_searchable: boolean; is_filterable: boolean; is_visible: boolean; is_active: boolean; is_system: boolean; created_at: string; updated_at: string };
export type CategoryField = { id: number; category_id: number; field_definition_id: number; is_required: boolean; inherit: boolean; is_visible: boolean; sort_order: number; default_value: unknown; source_category_id: number; inherited: boolean };
export type CustomFieldOption = { id: number; field_definition_id: number; code: string; label: string; sort_order: number; is_active: boolean; created_at: string; updated_at: string };
export type NomenclatureFieldValue = { field_definition_id: number; code: string; name: string; data_type: CustomFieldDataType; value: unknown; is_required: boolean; inherited: boolean; source_category_id: number };
export type CharacteristicDefinition = { id: number; code: string; name: string; is_active: boolean; created_at: string; updated_at: string };
export type CharacteristicOption = { id: number; characteristic_id: number; code: string; label: string; sort_order: number; is_active: boolean; created_at: string; updated_at: string };
export type CategoryCharacteristic = { id: number; category_id: number; characteristic_id: number; is_required: boolean; inherit: boolean; sort_order: number; inherited: boolean; source_category_id: number; created_at: string; updated_at: string };
export type NomenclatureCharacteristic = { id: number; nomenclature_id: number; characteristic_id: number; created_at: string; updated_at: string };
export type NomenclatureVariant = { id: number; nomenclature_id: number; article: string; name: string; is_active: boolean; option_ids: number[]; options: CharacteristicOption[]; created_at: string; updated_at: string };
export type NomenclatureMedia = { id: number; nomenclature_id: number; filename: string; mime_type: string; file_size: number; alt_text: string | null; sort_order: number; is_primary: boolean; created_at: string; updated_at: string; content_url: string };

export function fromApiNomenclature(item: ApiNomenclature): Nomenclature {
  return { ...item, basePrice: Number(item.base_price).toFixed(2) };
}

export function nomenclatureLabel(item: Nomenclature): string {
  return `${item.article} — ${item.name}`;
}

export async function getNomenclature(): Promise<Nomenclature[]> {
  const apiUrl = (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  const response = await fetch(`${apiUrl}/nomenclatures`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Не удалось загрузить номенклатуру (${response.status}).`);
  return (await response.json() as ApiNomenclature[]).map(fromApiNomenclature);
}

export async function getNomenclatureById(nomenclatureId: number): Promise<Nomenclature> {
  const apiUrl = (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  const response = await fetch(`${apiUrl}/nomenclatures/${nomenclatureId}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Не удалось загрузить карточку номенклатуры (${response.status}).`);
  return fromApiNomenclature(await response.json() as ApiNomenclature);
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

export async function getCustomFieldDefinitions(): Promise<CustomFieldDefinition[]> {
  const apiUrl = (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  const response = await fetch(`${apiUrl}/custom-fields`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Не удалось загрузить реквизиты (${response.status}).`);
  return await response.json() as CustomFieldDefinition[];
}

export async function getCategoryFields(categoryId: number): Promise<CategoryField[]> {
  const apiUrl = (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  const response = await fetch(`${apiUrl}/custom-fields/categories/${categoryId}/fields`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Не удалось загрузить реквизиты категории (${response.status}).`);
  return await response.json() as CategoryField[];
}

export async function getCustomFieldOptions(fieldId: number): Promise<CustomFieldOption[]> {
  const apiUrl = (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  const response = await fetch(`${apiUrl}/custom-fields/${fieldId}/options`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Не удалось загрузить варианты реквизита (${response.status}).`);
  return await response.json() as CustomFieldOption[];
}

export async function getNomenclatureFieldValues(nomenclatureId: number): Promise<NomenclatureFieldValue[]> {
  const apiUrl = (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  const response = await fetch(`${apiUrl}/custom-fields/nomenclatures/${nomenclatureId}/fields`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Не удалось загрузить реквизиты номенклатуры (${response.status}).`);
  return await response.json() as NomenclatureFieldValue[];
}

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

export function characteristicsApiPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized === "/characteristics" || normalized.startsWith("/characteristics/") ? normalized : `/characteristics${normalized}`;
}

async function getCharacteristicApi<T>(path: string): Promise<T> {
  const apiUrl = (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  const response = await fetch(`${apiUrl}${characteristicsApiPath(path)}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Не удалось загрузить характеристики (${response.status}).`);
  return await response.json() as T;
}
export const getCharacteristicDefinitions = () => getCharacteristicApi<CharacteristicDefinition[]>("/definitions");
export const getCategoryCharacteristics = (id: number) => getCharacteristicApi<CategoryCharacteristic[]>(`/categories/${id}`);
export const getNomenclatureCharacteristics = (id: number) => getCharacteristicApi<NomenclatureCharacteristic[]>(`/nomenclatures/${id}`);
export const getNomenclatureVariants = (id: number) => getCharacteristicApi<NomenclatureVariant[]>(`/nomenclatures/${id}/variants`);
export const getCharacteristicOptions = (id: number) => getCharacteristicApi<CharacteristicOption[]>(`/definitions/${id}/options`);
export async function getNomenclatureMedia(id: number): Promise<NomenclatureMedia[]> {
  const response = await fetch(`${apiBaseUrl()}/nomenclatures/${id}/media`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Не удалось загрузить media номенклатуры (${response.status}).`);
  return await response.json() as NomenclatureMedia[];
}
