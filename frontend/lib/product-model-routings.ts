/** Product-model routing whitelist + operation norms (`6.1.17`). */

export type ProductModelOperationNorm = {
  id: number;
  product_model_routing_link_id: number;
  production_stage_id: number | null;
  tech_operation_id: number | null;
  norm_qty_per_item: string;
  unit: string;
  created_at: string;
  updated_at: string;
};

export type ProductModelRoutingLink = {
  id: number;
  product_model_id: number;
  shop_routing_template_id: number;
  shop_routing_template_name: string | null;
  is_active: boolean;
  sort_order: number;
  operation_norms: ProductModelOperationNorm[];
  created_at: string;
  updated_at: string;
};

export type ProductModelOperationNormDraft = {
  production_stage_id: number | null;
  tech_operation_id: number | null;
  norm_qty_per_item: string;
  unit: string;
};

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export function parseNormQtyInput(raw: string): string | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,3})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return trimmed;
}

export function formatNormQty(value: string | number): string {
  const num = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(num)) return String(value);
  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

export function validateOperationNormDraft(
  draft: ProductModelOperationNormDraft,
): string | null {
  if (draft.production_stage_id == null && draft.tech_operation_id == null) {
    return "Укажите цех и/или технологическую операцию";
  }
  if (!draft.unit.trim()) {
    return "Укажите единицу нормы";
  }
  if (draft.unit.trim().length > 64) {
    return "Единица не длиннее 64 символов";
  }
  if (parseNormQtyInput(draft.norm_qty_per_item) == null) {
    return "Норма на изделие — число ≥ 0 (до 3 знаков после запятой)";
  }
  return null;
}

export function whitelistedRoutingTemplateIds(
  links: ProductModelRoutingLink[],
  options: { activeOnly?: boolean } = {},
): Set<number> {
  const rows = options.activeOnly
    ? links.filter((row) => row.is_active)
    : links;
  return new Set(rows.map((row) => row.shop_routing_template_id));
}

export function filterAvailableShopRoutingsForWhitelist<
  T extends { id: number; is_active: boolean; name: string; code?: string | null },
>(
  catalog: T[],
  links: ProductModelRoutingLink[],
  query = "",
): T[] {
  const linked = new Set(links.map((row) => row.shop_routing_template_id));
  const needle = query.trim().toLocaleLowerCase("ru");
  return catalog.filter((row) => {
    if (!row.is_active) return false;
    if (linked.has(row.id)) return false;
    if (!needle) return true;
    const code = (row.code ?? "").toLocaleLowerCase("ru");
    return (
      row.name.toLocaleLowerCase("ru").includes(needle) || code.includes(needle)
    );
  });
}

/** One display row = routing stage line + optional saved plan-hint norm. */
export type RoutingNormRow = {
  key: string;
  stage_order: number;
  production_stage_id: number | null;
  tech_operation_id: number | null;
  operation_label: string;
  unit: string;
  norm_qty_per_item: string;
  saved_norm_id: number | null;
};

export function buildRoutingNormRows(
  stageLines: Array<{
    stage_order: number;
    production_stage_id: number | null;
    stage_label: string;
    tech_operation_id: number | null;
  }>,
  norms: ProductModelOperationNorm[],
  techOperationsById: Map<
    number,
    { name: string; volume_unit: string }
  >,
): RoutingNormRow[] {
  const byKey = new Map<string, ProductModelOperationNorm>();
  for (const norm of norms) {
    byKey.set(
      `${norm.production_stage_id ?? "null"}:${norm.tech_operation_id ?? "null"}`,
      norm,
    );
  }

  return [...stageLines]
    .sort((a, b) => a.stage_order - b.stage_order)
    .map((line) => {
      const op =
        line.tech_operation_id != null
          ? techOperationsById.get(line.tech_operation_id)
          : undefined;
      const key = `${line.production_stage_id ?? "null"}:${line.tech_operation_id ?? "null"}`;
      const saved = byKey.get(key);
      const unit =
        saved?.unit ??
        op?.volume_unit ??
        "pieces";
      const opName = op?.name;
      const operation_label = opName
        ? `${line.stage_label} · ${opName}`
        : line.stage_label;
      return {
        key,
        stage_order: line.stage_order,
        production_stage_id: line.production_stage_id,
        tech_operation_id: line.tech_operation_id,
        operation_label,
        unit,
        norm_qty_per_item:
          saved != null ? String(saved.norm_qty_per_item) : "",
        saved_norm_id: saved?.id ?? null,
      };
    });
}

export async function getProductModelRoutings(
  modelId: number,
  options: { activeOnly?: boolean } = {},
): Promise<ProductModelRoutingLink[]> {
  const params = new URLSearchParams();
  if (options.activeOnly) params.set("active_only", "true");
  const query = params.toString();
  const response = await fetch(
    `${apiBaseUrl()}/product-models/${modelId}/routings${query ? `?${query}` : ""}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load model routings (${response.status})`);
  }
  return (await response.json()) as ProductModelRoutingLink[];
}
