export type ProductModelMaterialKind =
  | "print"
  | "fabric"
  | "cutting"
  | "hardware"
  | "packaging";

export type ProductModelMaterialLine = {
  id: number;
  product_model_id: number;
  kind: ProductModelMaterialKind;
  nomenclature_id: number;
  nomenclature_name: string | null;
  nomenclature_unit: string | null;
  planned_qty: string | number;
  sequence: number;
  fabric_stage_code: "print" | "cutting" | null;
  type_option_id: number | null;
  type_option_label: string | null;
  color_option_id: number | null;
  color_option_label: string | null;
  detailing_items: Array<{ id: number; name: string }>;
  created_at: string;
  updated_at: string;
};

export type ProductModelMaterialLineWrite = {
  kind: ProductModelMaterialKind;
  nomenclature_id: number;
  planned_qty: string;
  sequence?: number;
  fabric_stage_code?: "print" | "cutting" | null;
  type_option_id?: number | null;
  color_option_id?: number | null;
  detailing_item_ids?: number[];
  detailing_names?: string[];
};

export const MODEL_MATERIAL_KIND_LABELS: Record<ProductModelMaterialKind, string> =
  {
    print: "Печать",
    fabric: "Ткань",
    cutting: "Раскрой",
    hardware: "Фурнитура",
    packaging: "Упаковка",
  };

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export async function getProductModelMaterialLines(
  modelId: number,
  kind?: ProductModelMaterialKind,
): Promise<ProductModelMaterialLine[]> {
  const query = kind ? `?kind=${encodeURIComponent(kind)}` : "";
  const response = await fetch(
    `${apiBaseUrl()}/product-models/${modelId}/material-lines${query}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Не удалось загрузить материалы модели (${response.status})`);
  }
  return (await response.json()) as ProductModelMaterialLine[];
}

export async function replaceProductModelMaterialLinesApi(
  modelId: number,
  lines: ProductModelMaterialLineWrite[],
): Promise<ProductModelMaterialLine[]> {
  const response = await fetch(
    `${apiBaseUrl()}/product-models/${modelId}/material-lines`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lines }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : `Не удалось сохранить материалы (${response.status})`,
    );
  }
  return (await response.json()) as ProductModelMaterialLine[];
}
