import { rasterImageMimeOrNull, sameOriginApiMediaUrl } from "./api-media.ts";

export type ProductModelSizeType = "men" | "women" | "kids";
export type ProductModelStatus = "draft" | "active" | "archived";
export type ProductModelVersionState = "draft" | "published" | "archived";

export type ProductModel = {
  id: number;
  article: string;
  name: string;
  size_type: ProductModelSizeType;
  size_grid_id: number | null;
  product_type_id: number | null;
  product_type_name?: string | null;
  default_routing_template_id: number | null;
  description: string | null;
  patterns_path: string | null;
  constructor_name: string | null;
  /** ISO date `YYYY-MM-DD` or null. */
  patterns_created_on: string | null;
  cover_image_url: string | null;
  folder_id: number | null;
  sort_order: number;
  status: ProductModelStatus;
  has_journal_operations?: boolean;
  /** Catalog list: min assembly variant total (null when no variants). */
  assembly_cost_min?: string | number | null;
  /** Catalog list: max assembly variant total (null when no variants). */
  assembly_cost_max?: string | number | null;
  created_at: string;
  updated_at: string;
};

export type ProductModelFolder = {
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
  default_sewing_operation_template_id?: number | null;
  default_sewing_operation_template_name?: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductModelVersion = {
  id: number;
  product_model_id: number;
  version_number: number;
  label: string | null;
  state: ProductModelVersionState;
  note: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductModelMedia = {
  id: number;
  product_model_id: number;
  filename: string;
  mime_type: string;
  file_size: number;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  content_url: string;
};

export type ProductModelHistoryEntry = {
  id: number;
  product_model_id: number;
  actor: string;
  action: string;
  created_at: string;
};

/** View model for PT-08 version bar (demo + API). */
export type ProductModelVersionView = {
  id: string;
  label: string;
  state: ProductModelVersionState;
  updatedAt: string;
  author: string;
  isActive: boolean;
  isPublishedBaseline: boolean;
};

export type ProductModelListParams = {
  search?: string;
  status?: ProductModelStatus;
  size_type?: ProductModelSizeType;
  product_type_id?: number;
  limit?: number;
  offset?: number;
};

export const PRODUCT_MODEL_SIZE_TYPE_LABELS: Record<ProductModelSizeType, string> = {
  men: "Мужской",
  women: "Женский",
  kids: "Детский",
};

export const PRODUCT_MODEL_STATUS_LABELS: Record<ProductModelStatus, string> = {
  draft: "Черновик",
  active: "Используется",
  archived: "В архиве",
};

export const PRODUCT_MODEL_STATUS_FILTER_ITEMS: ReadonlyArray<{
  id: ProductModelStatus;
  label: string;
}> = [
  { id: "draft", label: PRODUCT_MODEL_STATUS_LABELS.draft },
  { id: "active", label: PRODUCT_MODEL_STATUS_LABELS.active },
  { id: "archived", label: PRODUCT_MODEL_STATUS_LABELS.archived },
];

export const PRODUCT_MODEL_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const PRODUCT_MODEL_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const PRODUCT_MODEL_IMAGE_RULE = "JPEG / PNG / WebP, до 10 МБ";

export function productModelStatusTone(
  status: ProductModelStatus,
): "neutral" | "success" | "warning" {
  if (status === "active") return "success";
  if (status === "draft") return "warning";
  return "neutral";
}

export function productModelLabel(model: Pick<ProductModel, "article" | "name">): string {
  return `${model.article} — ${model.name}`;
}

export function validateProductModelImageFile(file: File): string | null {
  if (rasterImageMimeOrNull(file) == null) {
    return PRODUCT_MODEL_IMAGE_RULE;
  }
  if (file.size <= 0 || file.size > PRODUCT_MODEL_IMAGE_MAX_BYTES) {
    return PRODUCT_MODEL_IMAGE_RULE;
  }
  return null;
}

export type ProductModelCreateDraft = {
  article: string;
  name: string;
  size_type: ProductModelSizeType;
  description: string;
  size_grid_id: number | null;
  /** Optional catalog folder (`6.1.18`); omit on card requisites draft. */
  folder_id?: number | null;
};

export type ProductModelRequisitesDraft = ProductModelCreateDraft & {
  patterns_path: string;
  constructor_name: string;
  /** `YYYY-MM-DD` or empty string when unset. */
  patterns_created_on: string;
  product_type_id: number | null;
  default_routing_template_id: number | null;
};

export const MODEL_OPERATIONS_WARNING =
  "По данной модели были операции! Изменения могут затронуть отчетность!";

export function toProductModelRequisitesDraft(
  model: Pick<
    ProductModel,
    | "article"
    | "name"
    | "size_type"
    | "description"
    | "size_grid_id"
    | "patterns_path"
    | "constructor_name"
    | "patterns_created_on"
    | "product_type_id"
    | "default_routing_template_id"
    | "folder_id"
  >,
): ProductModelRequisitesDraft {
  return {
    article: model.article,
    name: model.name,
    size_type: model.size_type,
    description: model.description ?? "",
    size_grid_id: model.size_grid_id,
    patterns_path: model.patterns_path ?? "",
    constructor_name: model.constructor_name ?? "",
    patterns_created_on: model.patterns_created_on ?? "",
    product_type_id: model.product_type_id,
    default_routing_template_id: model.default_routing_template_id,
    folder_id: model.folder_id ?? null,
  };
}

/** True when draft differs from the persisted model requisites (`6.1.10.2`). */
export function isProductModelRequisitesDirty(
  model: Pick<
    ProductModel,
    | "article"
    | "name"
    | "size_type"
    | "description"
    | "size_grid_id"
    | "patterns_path"
    | "constructor_name"
    | "patterns_created_on"
    | "product_type_id"
    | "default_routing_template_id"
    | "folder_id"
  >,
  draft: ProductModelRequisitesDraft,
): boolean {
  return (
    draft.article !== model.article ||
    draft.name !== model.name ||
    draft.size_type !== model.size_type ||
    draft.description !== (model.description ?? "") ||
    draft.size_grid_id !== model.size_grid_id ||
    draft.patterns_path !== (model.patterns_path ?? "") ||
    draft.constructor_name !== (model.constructor_name ?? "") ||
    draft.patterns_created_on !== (model.patterns_created_on ?? "") ||
    draft.product_type_id !== model.product_type_id ||
    draft.default_routing_template_id !== model.default_routing_template_id ||
    (draft.folder_id ?? null) !== (model.folder_id ?? null)
  );
}

/** Client-side create/edit draft validation (`6.1.9.2` / `6.1.10`). */
export function validateProductModelCreateDraft(
  draft: ProductModelCreateDraft,
): string | null {
  if (!draft.article.trim()) {
    return "Укажите артикул";
  }
  if (draft.article.trim().length > 100) {
    return "Артикул не длиннее 100 символов";
  }
  if (!draft.name.trim()) {
    return "Укажите название";
  }
  if (draft.name.trim().length > 255) {
    return "Название не длиннее 255 символов";
  }
  if (draft.size_grid_id == null || !Number.isSafeInteger(draft.size_grid_id)) {
    return "Выберите размерную сетку";
  }
  return null;
}

export function productModelCoverUrl(url: string | null | undefined): string | null {
  return sameOriginApiMediaUrl(url);
}

export function parseProductModelRouteId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

export function filterProductModels(
  models: ProductModel[],
  {
    search = "",
    status = "",
    sizeType = "",
    productTypeId = null,
  }: {
    search?: string;
    status?: "" | ProductModelStatus;
    sizeType?: "" | ProductModelSizeType;
    productTypeId?: number | null;
  },
): ProductModel[] {
  const query = search.trim().toLocaleLowerCase();
  return models.filter((model) => {
    const matchesQuery =
      !query ||
      `${model.article} ${model.name} ${model.description ?? ""} ${model.product_type_name ?? ""}`
        .toLocaleLowerCase()
        .includes(query);
    const matchesStatus = !status || model.status === status;
    const matchesSizeType = !sizeType || model.size_type === sizeType;
    const matchesProductType =
      productTypeId == null || model.product_type_id === productTypeId;
    return matchesQuery && matchesStatus && matchesSizeType && matchesProductType;
  });
}

export function toProductModelVersionViews(
  versions: ProductModelVersion[],
): ProductModelVersionView[] {
  const published = versions.find((version) => version.state === "published");
  const draft = versions.find((version) => version.state === "draft");
  const activeId = draft?.id ?? published?.id ?? versions[0]?.id;

  return versions.map((version) => ({
    id: String(version.id),
    label: version.label?.trim() || `v${version.version_number}`,
    state: version.state,
    updatedAt: version.updated_at,
    author: "—",
    isActive: version.id === activeId,
    isPublishedBaseline: version.state === "published",
  }));
}

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

function normalizeProductModel(row: ProductModel): ProductModel {
  return {
    ...row,
    folder_id:
      row.folder_id == null || Number(row.folder_id) <= 0
        ? null
        : Number(row.folder_id),
    sort_order: Number(row.sort_order ?? 0) || 0,
  };
}

export async function getProductModels(
  params: ProductModelListParams = {},
): Promise<ProductModel[]> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.status) query.set("status", params.status);
  if (params.size_type) query.set("size_type", params.size_type);
  if (params.product_type_id != null) {
    query.set("product_type_id", String(params.product_type_id));
  }
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await fetch(`${apiBaseUrl()}/product-models${suffix}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить модели изделий (${response.status}).`);
  }
  const rows = (await response.json()) as ProductModel[];
  return rows.map(normalizeProductModel);
}

export async function getProductModelFolders(): Promise<ProductModelFolder[]> {
  const response = await fetch(`${apiBaseUrl()}/product-model-folders`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `Не удалось загрузить папки моделей изделий (${response.status}).`,
    );
  }
  const rows = (await response.json()) as ProductModelFolder[];
  return rows.map((row) => ({
    ...row,
    parent_id:
      row.parent_id == null || Number(row.parent_id) <= 0
        ? null
        : Number(row.parent_id),
    sort_order: Number(row.sort_order ?? 0) || 0,
    default_sewing_operation_template_id:
      row.default_sewing_operation_template_id == null ||
      Number(row.default_sewing_operation_template_id) <= 0
        ? null
        : Number(row.default_sewing_operation_template_id),
    default_sewing_operation_template_name:
      row.default_sewing_operation_template_name?.trim() || null,
  }));
}

export type ProductModelCatalogTreeRow =
  | {
      kind: "folder";
      id: number;
      name: string;
      parent_id: number | null;
      sort_order: number;
      depth: number;
      folder: ProductModelFolder;
    }
  | {
      kind: "model";
      id: number;
      name: string;
      parent_id: number | null;
      sort_order: number;
      depth: number;
      model: ProductModel;
    };

/** Build depth-first catalog rows: folders then models under each parent. */
export function buildProductModelCatalogTreeRows(
  folders: ProductModelFolder[],
  models: ProductModel[],
  options?: {
    /** When set, replaces default `sort_order` ordering for models in each folder. */
    compareModels?: (a: ProductModel, b: ProductModel) => number;
  },
): ProductModelCatalogTreeRow[] {
  const childrenOf = new Map<number | null, ProductModelFolder[]>();
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

  const modelsOf = new Map<number | null, ProductModel[]>();
  for (const model of models) {
    const key = model.folder_id;
    const list = modelsOf.get(key) ?? [];
    list.push(model);
    modelsOf.set(key, list);
  }
  const compareModels =
    options?.compareModels ??
    ((a: ProductModel, b: ProductModel) =>
      a.sort_order - b.sort_order ||
      a.name.localeCompare(b.name, "ru") ||
      a.id - b.id);
  for (const list of modelsOf.values()) {
    list.sort(compareModels);
  }

  const rows: ProductModelCatalogTreeRow[] = [];

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
    for (const model of modelsOf.get(parentId) ?? []) {
      rows.push({
        kind: "model",
        id: model.id,
        name: model.name,
        parent_id: model.folder_id,
        sort_order: model.sort_order,
        depth,
        model,
      });
    }
  };

  walk(null, 0);
  return rows;
}

/** Flatten catalog folders for a card/create Select (`26.7.1` / `6.1.18`). */
export function productModelFolderSelectOptions(
  folders: ProductModelFolder[],
): Array<{ id: number; name: string; depth: number }> {
  return buildProductModelCatalogTreeRows(folders, [])
    .filter(
      (row): row is Extract<ProductModelCatalogTreeRow, { kind: "folder" }> =>
        row.kind === "folder",
    )
    .map((row) => ({ id: row.id, name: row.name, depth: row.depth }));
}

export type ProductModelListSortField =
  | "article"
  | "name"
  | "product_type"
  | "size_grid"
  | "status"
  | "cost";

export type ProductModelListSortDirection = "asc" | "desc";

/** Comparator for catalog column sort (models within each folder). */
export function compareProductModelsByListSort(
  a: ProductModel,
  b: ProductModel,
  field: ProductModelListSortField,
  direction: ProductModelListSortDirection,
  labels: {
    productType: (model: ProductModel) => string;
    sizeGrid: (model: ProductModel) => string;
    cost: (model: ProductModel) => number | null;
  },
): number {
  const dir = direction === "asc" ? 1 : -1;
  let comparison = 0;
  switch (field) {
    case "article":
      comparison = a.article.localeCompare(b.article, "ru", { sensitivity: "base" });
      break;
    case "name":
      comparison = a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
      break;
    case "product_type":
      comparison = labels
        .productType(a)
        .localeCompare(labels.productType(b), "ru", { sensitivity: "base" });
      break;
    case "size_grid":
      comparison = labels
        .sizeGrid(a)
        .localeCompare(labels.sizeGrid(b), "ru", { sensitivity: "base" });
      break;
    case "status":
      comparison = PRODUCT_MODEL_STATUS_LABELS[a.status].localeCompare(
        PRODUCT_MODEL_STATUS_LABELS[b.status],
        "ru",
        { sensitivity: "base" },
      );
      break;
    case "cost": {
      const costA = labels.cost(a);
      const costB = labels.cost(b);
      if (costA == null && costB == null) comparison = 0;
      else if (costA == null) comparison = 1;
      else if (costB == null) comparison = -1;
      else comparison = costA - costB;
      break;
    }
  }
  if (comparison === 0) {
    comparison =
      a.sort_order - b.sort_order ||
      a.name.localeCompare(b.name, "ru") ||
      a.id - b.id;
    return comparison;
  }
  return comparison * dir;
}

export function visibleProductModelCatalogTreeRows(
  rows: ProductModelCatalogTreeRow[],
  expandedFolderIds: Set<number>,
): ProductModelCatalogTreeRow[] {
  const visible: ProductModelCatalogTreeRow[] = [];
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

export async function getProductModelById(
  modelId: number,
): Promise<ProductModel | null> {
  const response = await fetch(`${apiBaseUrl()}/product-models/${modelId}`, {
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Не удалось загрузить модель изделия (${response.status}).`);
  }
  return normalizeProductModel((await response.json()) as ProductModel);
}

export async function getProductModelVersions(
  modelId: number,
): Promise<ProductModelVersion[]> {
  const response = await fetch(
    `${apiBaseUrl()}/product-models/${modelId}/versions`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(
      `Не удалось загрузить версии модели изделия (${response.status}).`,
    );
  }
  return (await response.json()) as ProductModelVersion[];
}

export async function getProductModelMedia(
  modelId: number,
): Promise<ProductModelMedia[]> {
  const response = await fetch(
    `${apiBaseUrl()}/product-models/${modelId}/media`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(
      `Не удалось загрузить фото модели изделия (${response.status}).`,
    );
  }
  return (await response.json()) as ProductModelMedia[];
}

export async function getProductModelHistory(
  modelId: number,
): Promise<ProductModelHistoryEntry[]> {
  const response = await fetch(
    `${apiBaseUrl()}/product-models/${modelId}/history`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(
      `Не удалось загрузить историю модели изделия (${response.status}).`,
    );
  }
  return (await response.json()) as ProductModelHistoryEntry[];
}

export type AssemblyOperationLine = {
  id: number;
  assembly_variant_id: number;
  sequence: number;
  operation_name: string;
  cost: string;
  quantity_per_item: number;
  line_total?: string;
  duration_seconds: number;
  sewing_operation_id: number | null;
  created_at: string;
  updated_at: string;
};

export type AssemblyVariant = {
  id: number;
  product_model_id: number;
  name: string;
  is_active: boolean;
  sort_order: number;
  total_cost: string;
  operation_lines: AssemblyOperationLine[];
  created_at: string;
  updated_at: string;
};

export type AssemblyVariantDraft = {
  name: string;
};

export type AssemblyOperationLineDraft = {
  operation_name: string;
  cost: string;
};

/** Display money from API Decimal JSON (`6.1.12`). */
export function formatAssemblyCost(value: string | number): string {
  const amount = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(amount)) {
    return "0,00";
  }
  // Deterministic ru-style decimals (avoid toLocaleString SSR/client hydration drift).
  return amount.toFixed(2).replace(".", ",");
}

/** Min/max `total_cost` across assembly variants (`от` / `до`). */
export function assemblyVariantCostRange(
  variants: ReadonlyArray<Pick<AssemblyVariant, "total_cost">>,
): { min: number; max: number } | null {
  if (variants.length === 0) return null;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const variant of variants) {
    const amount = Number(String(variant.total_cost).replace(",", "."));
    if (!Number.isFinite(amount)) continue;
    if (amount < min) min = amount;
    if (amount > max) max = amount;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

export function formatAssemblyVariantCostRange(
  variants: ReadonlyArray<Pick<AssemblyVariant, "total_cost">>,
): string {
  const range = assemblyVariantCostRange(variants);
  if (range == null) return "—";
  if (range.min === range.max) {
    return `${formatAssemblyCost(range.min)} ₽`;
  }
  return `от ${formatAssemblyCost(range.min)} — до ${formatAssemblyCost(range.max)} ₽`;
}

/** Format list cost column from API `assembly_cost_min` / `assembly_cost_max`. */
export function formatAssemblyCostBounds(
  min: string | number | null | undefined,
  max: string | number | null | undefined,
): string {
  if (min == null || max == null) return "—";
  return formatAssemblyVariantCostRange([
    { total_cost: String(min) },
    { total_cost: String(max) },
  ]);
}

/** Normalize user cost input to API decimal string, or null if invalid. */
export function parseAssemblyCostInput(raw: string): string | null {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount.toFixed(2);
}

export function validateAssemblyVariantDraft(
  draft: AssemblyVariantDraft,
): string | null {
  if (!draft.name.trim()) {
    return "Укажите название варианта";
  }
  if (draft.name.trim().length > 255) {
    return "Название варианта не длиннее 255 символов";
  }
  return null;
}

export function validateAssemblyOperationLineDraft(
  draft: AssemblyOperationLineDraft,
): string | null {
  if (!draft.operation_name.trim()) {
    return "Укажите название операции";
  }
  if (draft.operation_name.trim().length > 255) {
    return "Название операции не длиннее 255 символов";
  }
  if (parseAssemblyCostInput(draft.cost) == null) {
    return "Укажите стоимость операции (число ≥ 0)";
  }
  return null;
}

/** Sum catalog line totals (cost × quantity_per_item) of selected sewing operations. */
export function sumSelectedSewingOperationCosts(
  operations: Array<{
    cost: string | number;
    quantity_per_item?: string | number | null;
  }>,
): number {
  return operations.reduce((total, operation) => {
    const amount =
      typeof operation.cost === "number"
        ? operation.cost
        : Number(String(operation.cost).replace(",", "."));
    const qtyRaw =
      typeof operation.quantity_per_item === "number"
        ? operation.quantity_per_item
        : Number(String(operation.quantity_per_item ?? "1").replace(",", "."));
    const qty =
      Number.isSafeInteger(qtyRaw) && qtyRaw >= 1 ? Math.floor(qtyRaw) : 1;
    return total + (Number.isFinite(amount) ? amount * qty : 0);
  }, 0);
}

/** Line sum for an assembly operation: cost × quantity_per_item. */
export function assemblyOperationLineTotal(
  line: Pick<AssemblyOperationLine, "cost" | "quantity_per_item"> & {
    line_total?: string | number;
  },
): number {
  if (line.line_total != null && line.line_total !== "") {
    const fromApi =
      typeof line.line_total === "number"
        ? line.line_total
        : Number(String(line.line_total).replace(",", "."));
    if (Number.isFinite(fromApi)) return fromApi;
  }
  const amount = Number(String(line.cost).replace(",", "."));
  const qty = Math.max(1, Number(line.quantity_per_item) || 1);
  return Number.isFinite(amount) ? amount * qty : 0;
}

/** Sum snapshot duration_seconds × quantity across assembly variant lines. */
export function sumAssemblyVariantDurationSeconds(
  lines: ReadonlyArray<
    Pick<AssemblyOperationLine, "duration_seconds" | "quantity_per_item">
  >,
): number {
  return lines.reduce((total, line) => {
    const value = Number(line.duration_seconds);
    const qty = Math.max(1, Number(line.quantity_per_item) || 1);
    return (
      total +
      (Number.isFinite(value) && value > 0 ? Math.floor(value) * qty : 0)
    );
  }, 0);
}

export async function getProductModelAssemblyVariants(
  modelId: number,
  options?: { activeOnly?: boolean },
): Promise<AssemblyVariant[]> {
  const params = new URLSearchParams();
  if (options?.activeOnly) {
    params.set("active_only", "true");
  }
  const query = params.toString();
  const response = await fetch(
    `${apiBaseUrl()}/product-models/${modelId}/assembly-variants${query ? `?${query}` : ""}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(
      `Не удалось загрузить варианты сборки (${response.status}).`,
    );
  }
  return (await response.json()) as AssemblyVariant[];
}
