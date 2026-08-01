/**
 * Shop routing templates (`/shop-routings`) and work centers (`/work-centers`).
 * Product models link via `default_routing_template_id` on PATCH `/product-models/{id}`.
 */

export type WorkCenter = {
  id: number;
  name: string;
  code: string;
  production_stage_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ShopRoutingStageLine = {
  id: number;
  routing_template_id: number;
  stage_order: number;
  production_stage_id: number | null;
  stage_label: string;
  tech_operation_id: number | null;
  work_center_id: number | null;
  is_quality_checkpoint: boolean;
  created_at: string;
  updated_at: string;
};

export type ShopRoutingTemplate = {
  id: number;
  name: string;
  code: string | null;
  is_active: boolean;
  notes: string | null;
  stage_lines: ShopRoutingStageLine[];
  created_at: string;
  updated_at: string;
};

export type ShopRoutingStageDraft = {
  stage_order: number;
  production_stage_id: number | null;
  stage_label: string;
  tech_operation_id: number | null;
  work_center_id: number | null;
  is_quality_checkpoint: boolean;
};

export type ShopRoutingCreateDraft = {
  name: string;
  code: string;
  is_active: boolean;
  stages: ShopRoutingStageDraft[];
};

export type ShopRoutingListParams = {
  search?: string;
  active_only?: boolean;
  limit?: number;
  offset?: number;
};

export type WorkCenterListParams = {
  search?: string;
  active_only?: boolean;
  production_stage_id?: number;
  production_stage_code?: string;
  limit?: number;
  offset?: number;
};

export type WorkCenterDraft = {
  name: string;
  code: string;
  production_stage_id: number | null;
  is_active: boolean;
};

export function filterWorkCenters(
  rows: WorkCenter[],
  query: string,
): WorkCenter[] {
  const needle = query.trim().toLocaleLowerCase("ru");
  if (!needle) return rows;
  return rows.filter(
    (row) =>
      row.name.toLocaleLowerCase("ru").includes(needle) ||
      row.code.toLocaleLowerCase("ru").includes(needle),
  );
}

export function validateWorkCenterDraft(draft: WorkCenterDraft): string | null {
  if (!draft.name.trim()) return "Укажите наименование";
  if (draft.name.trim().length > 255) {
    return "Наименование не длиннее 255 символов";
  }
  if (!draft.code.trim()) return "Укажите код";
  if (draft.code.trim().length > 64) return "Код не длиннее 64 символов";
  if (
    draft.production_stage_id != null &&
    (!Number.isSafeInteger(draft.production_stage_id) ||
      draft.production_stage_id <= 0)
  ) {
    return "Выберите корректный цех";
  }
  return null;
}

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export function parseShopRoutingRouteId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return id;
}

export function shopRoutingStageCount(template: ShopRoutingTemplate): number {
  return template.stage_lines?.length ?? 0;
}

export function filterShopRoutings(
  templates: ShopRoutingTemplate[],
  query: string,
): ShopRoutingTemplate[] {
  const needle = query.trim().toLocaleLowerCase("ru");
  if (!needle) return templates;
  return templates.filter((row) => {
    const code = row.code ?? "";
    return (
      row.name.toLocaleLowerCase("ru").includes(needle) ||
      code.toLocaleLowerCase("ru").includes(needle)
    );
  });
}

export function validateShopRoutingCreateDraft(
  draft: ShopRoutingCreateDraft,
): string | null {
  if (!draft.name.trim()) {
    return "Укажите наименование маршрута";
  }
  if (draft.name.trim().length > 255) {
    return "Наименование не длиннее 255 символов";
  }
  if (draft.code.trim().length > 64) {
    return "Код не длиннее 64 символов";
  }
  if (draft.stages.length === 0) {
    return "Добавьте хотя бы один этап маршрута";
  }
  for (const stage of draft.stages) {
    if (stage.production_stage_id == null || stage.production_stage_id <= 0) {
      return "Выберите цех для каждого этапа";
    }
    if (!Number.isSafeInteger(stage.stage_order) || stage.stage_order < 1) {
      return "Порядок этапа — целое число ≥ 1";
    }
  }
  return null;
}

export function validateShopRoutingStages(
  stages: ShopRoutingStageDraft[],
): string | null {
  if (stages.length === 0) {
    return "Маршрут должен содержать хотя бы один этап";
  }
  for (const stage of stages) {
    if (stage.production_stage_id == null || stage.production_stage_id <= 0) {
      return "Выберите цех для каждого этапа";
    }
    if (!Number.isSafeInteger(stage.stage_order) || stage.stage_order < 1) {
      return "Порядок этапа — целое число ≥ 1";
    }
  }
  return null;
}

export function toShopRoutingStageDrafts(
  template: ShopRoutingTemplate,
): ShopRoutingStageDraft[] {
  return [...template.stage_lines]
    .sort((a, b) => a.stage_order - b.stage_order)
    .map((line) => ({
      stage_order: line.stage_order,
      production_stage_id: line.production_stage_id,
      stage_label: line.stage_label,
      tech_operation_id: line.tech_operation_id,
      work_center_id: line.work_center_id,
      is_quality_checkpoint: line.is_quality_checkpoint,
    }));
}

/** Build create payload that duplicates a routing preset (unique name; code cleared). */
export function buildShopRoutingCopyDraft(
  source: ShopRoutingTemplate,
): ShopRoutingCreateDraft {
  return {
    name: `${source.name} (копия)`,
    code: "",
    is_active: source.is_active,
    stages: toShopRoutingStageDrafts(source),
  };
}

export async function getShopRoutings(
  params: ShopRoutingListParams = {},
): Promise<ShopRoutingTemplate[]> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.active_only != null) {
    query.set("active_only", String(params.active_only));
  }
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await fetch(`${apiBaseUrl()}/shop-routings${suffix}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить маршруты (${response.status}).`);
  }
  return (await response.json()) as ShopRoutingTemplate[];
}

export async function getShopRouting(
  templateId: number,
): Promise<ShopRoutingTemplate | null> {
  const response = await fetch(`${apiBaseUrl()}/shop-routings/${templateId}`, {
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Не удалось загрузить маршрут (${response.status}).`);
  }
  return (await response.json()) as ShopRoutingTemplate;
}

export async function getWorkCenters(
  params: WorkCenterListParams = {},
): Promise<WorkCenter[]> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.active_only != null) {
    query.set("active_only", String(params.active_only));
  }
  if (params.production_stage_id != null) {
    query.set("production_stage_id", String(params.production_stage_id));
  }
  if (params.production_stage_code?.trim()) {
    query.set("production_stage_code", params.production_stage_code.trim());
  }
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await fetch(`${apiBaseUrl()}/work-centers${suffix}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить рабочие центры (${response.status}).`);
  }
  return (await response.json()) as WorkCenter[];
}
