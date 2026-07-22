export type ProductModelSizeType = "men" | "women" | "kids";
export type ProductModelStatus = "draft" | "active" | "archived";
export type ProductModelVersionState = "draft" | "published" | "archived";

export type ProductModel = {
  id: number;
  article: string;
  name: string;
  size_type: ProductModelSizeType;
  size_grid_id: number | null;
  description: string | null;
  cover_image_url: string | null;
  status: ProductModelStatus;
  has_journal_operations?: boolean;
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
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(file.type)) {
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
};

export type ProductModelRequisitesDraft = ProductModelCreateDraft;

export const MODEL_OPERATIONS_WARNING =
  "По данной модели были операции! Изменения могут затронуть отчетность!";

export function toProductModelRequisitesDraft(
  model: Pick<
    ProductModel,
    "article" | "name" | "size_type" | "description" | "size_grid_id"
  >,
): ProductModelRequisitesDraft {
  return {
    article: model.article,
    name: model.name,
    size_type: model.size_type,
    description: model.description ?? "",
    size_grid_id: model.size_grid_id,
  };
}

/** True when draft differs from the persisted model requisites (`6.1.10.2`). */
export function isProductModelRequisitesDirty(
  model: Pick<
    ProductModel,
    "article" | "name" | "size_type" | "description" | "size_grid_id"
  >,
  draft: ProductModelRequisitesDraft,
): boolean {
  return (
    draft.article !== model.article ||
    draft.name !== model.name ||
    draft.size_type !== model.size_type ||
    draft.description !== (model.description ?? "") ||
    draft.size_grid_id !== model.size_grid_id
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
  if (!url?.trim()) return null;
  const value = url.trim();
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("blob:")
  ) {
    return value;
  }
  // Uploaded images are served by the API; public assets stay on the Next origin.
  if (
    value.startsWith("/product-models/") &&
    (value.includes("/cover/") || value.includes("/media/"))
  ) {
    const api = (
      process.env.NEXT_PUBLIC_SPORT_LEADS_API_URL ??
      process.env.SPORT_LEADS_API_URL ??
      "http://127.0.0.1:8000"
    ).replace(/\/$/, "");
    return `${api}${value}`;
  }
  if (value.startsWith("/")) return value;
  return `/${value.replace(/^\.\//, "")}`;
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
  }: {
    search?: string;
    status?: "" | ProductModelStatus;
    sizeType?: "" | ProductModelSizeType;
  },
): ProductModel[] {
  const query = search.trim().toLocaleLowerCase();
  return models.filter((model) => {
    const matchesQuery =
      !query ||
      `${model.article} ${model.name} ${model.description ?? ""}`
        .toLocaleLowerCase()
        .includes(query);
    const matchesStatus = !status || model.status === status;
    const matchesSizeType = !sizeType || model.size_type === sizeType;
    return matchesQuery && matchesStatus && matchesSizeType;
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

export async function getProductModels(
  params: ProductModelListParams = {},
): Promise<ProductModel[]> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.status) query.set("status", params.status);
  if (params.size_type) query.set("size_type", params.size_type);
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await fetch(`${apiBaseUrl()}/product-models${suffix}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить модели изделий (${response.status}).`);
  }
  return (await response.json()) as ProductModel[];
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
  return (await response.json()) as ProductModel;
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
  return amount.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

/** Sum catalog costs of selected sewing operations (variant total preview). */
export function sumSelectedSewingOperationCosts(
  operations: Array<{ cost: string | number }>,
): number {
  return operations.reduce((total, operation) => {
    const amount =
      typeof operation.cost === "number"
        ? operation.cost
        : Number(String(operation.cost).replace(",", "."));
    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

export async function getProductModelAssemblyVariants(
  modelId: number,
): Promise<AssemblyVariant[]> {
  const response = await fetch(
    `${apiBaseUrl()}/product-models/${modelId}/assembly-variants`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(
      `Не удалось загрузить варианты сборки (${response.status}).`,
    );
  }
  return (await response.json()) as AssemblyVariant[];
}
