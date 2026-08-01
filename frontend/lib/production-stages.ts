export type ProductionStage = {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProductionStageDraft = {
  name: string;
  code: string;
  is_active: boolean;
  sort_order: number;
};

export type ProductionStageListParams = {
  search?: string;
  active_only?: boolean;
  limit?: number;
  offset?: number;
};

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export function validateProductionStageDraft(
  draft: ProductionStageDraft,
): string | null {
  if (!draft.name.trim()) return "Укажите наименование цеха";
  if (draft.name.trim().length > 255) {
    return "Наименование не длиннее 255 символов";
  }
  if (!draft.code.trim()) return "Укажите код цеха";
  if (draft.code.trim().length > 64) return "Код не длиннее 64 символов";
  if (!Number.isSafeInteger(draft.sort_order) || draft.sort_order < 0) {
    return "Порядок сортировки — целое число ≥ 0";
  }
  return null;
}

export function filterProductionStages(
  stages: ProductionStage[],
  query: string,
): ProductionStage[] {
  const needle = query.trim().toLocaleLowerCase("ru");
  if (!needle) return stages;
  return stages.filter(
    (stage) =>
      stage.name.toLocaleLowerCase("ru").includes(needle) ||
      stage.code.toLocaleLowerCase("ru").includes(needle),
  );
}

/** Stable catalog order step (10, 20, 30…). */
export const PRODUCTION_STAGE_ORDER_STEP = 10;

export function nextProductionStageSortOrder(
  stages: ReadonlyArray<Pick<ProductionStage, "sort_order">>,
): number {
  if (stages.length === 0) return PRODUCTION_STAGE_ORDER_STEP;
  const max = Math.max(...stages.map((stage) => stage.sort_order));
  return max + PRODUCTION_STAGE_ORDER_STEP;
}

export function applyProductionStageOrder<T extends { id: number; sort_order: number }>(
  stages: readonly T[],
  orderedIds: readonly number[],
): T[] {
  const byId = new Map(stages.map((stage) => [stage.id, stage]));
  const next: T[] = [];
  orderedIds.forEach((id, index) => {
    const stage = byId.get(id);
    if (!stage) return;
    next.push({
      ...stage,
      sort_order: (index + 1) * PRODUCTION_STAGE_ORDER_STEP,
    });
  });
  return next;
}

export function moveProductionStageInOrder<T extends { id: number; sort_order: number }>(
  stages: readonly T[],
  stageId: number,
  direction: -1 | 1,
): T[] | null {
  const ordered = [...stages].sort(
    (a, b) => a.sort_order - b.sort_order || a.id - b.id,
  );
  const index = ordered.findIndex((stage) => stage.id === stageId);
  if (index < 0) return null;
  const target = index + direction;
  if (target < 0 || target >= ordered.length) return null;
  const swapped = [...ordered];
  const [moved] = swapped.splice(index, 1);
  swapped.splice(target, 0, moved);
  return applyProductionStageOrder(
    swapped,
    swapped.map((stage) => stage.id),
  );
}

export async function getProductionStages(
  params: ProductionStageListParams = {},
): Promise<ProductionStage[]> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.active_only != null) {
    query.set("active_only", String(params.active_only));
  }
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await fetch(`${apiBaseUrl()}/production-stages${suffix}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить цеха (${response.status}).`);
  }
  return (await response.json()) as ProductionStage[];
}

export async function getProductionStage(
  stageId: number,
): Promise<ProductionStage | null> {
  const response = await fetch(`${apiBaseUrl()}/production-stages/${stageId}`, {
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Не удалось загрузить цех (${response.status}).`);
  }
  return (await response.json()) as ProductionStage;
}
