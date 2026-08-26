"use server";

import { revalidatePath } from "next/cache";

import {
  PRODUCT_MODEL_IMAGE_MAX_BYTES,
  PRODUCT_MODEL_IMAGE_RULE,
  type ProductModel,
  type ProductModelFolder,
  type ProductModelMedia,
  type ProductModelSizeType,
} from "@/lib/product-models";
import { rasterImageMimeOrNull } from "@/lib/api-media";

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

async function readError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as
    | { detail?: string | Array<{ msg?: string }> }
    | null;
  if (typeof data?.detail === "string") {
    return data.detail;
  }
  if (Array.isArray(data?.detail) && data.detail.length > 0) {
    return data.detail
      .map((item) => item.msg)
      .filter(Boolean)
      .join("; ") || `Ошибка API (${response.status})`;
  }
  return `Ошибка API (${response.status})`;
}

function revalidateModel(modelId: string | number) {
  revalidatePath("/settings/catalogs/product-models");
  revalidatePath(`/settings/catalogs/product-models/${modelId}`);
}

function validateImageFile(file: File): string {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error(PRODUCT_MODEL_IMAGE_RULE);
  }
  if (file.size > PRODUCT_MODEL_IMAGE_MAX_BYTES) {
    throw new Error(PRODUCT_MODEL_IMAGE_RULE);
  }
  const mime = rasterImageMimeOrNull(file);
  if (mime == null) {
    throw new Error(PRODUCT_MODEL_IMAGE_RULE);
  }
  return mime;
}

export type ProductModelRequisitesInput = {
  article: string;
  name: string;
  size_type: ProductModelSizeType;
  description: string | null;
  size_grid_id?: number | null;
  product_type_id?: number | null;
  default_routing_template_id?: number | null;
  patterns_path?: string | null;
  constructor_name?: string | null;
  patterns_created_on?: string | null;
  folder_id?: number | null;
};

export type ProductModelCreateResult =
  | { ok: true; model: ProductModel }
  | { ok: false; message: string };

function normalizeProductModel(model: ProductModel): ProductModel {
  return {
    ...model,
    folder_id:
      model.folder_id == null || Number(model.folder_id) <= 0
        ? null
        : Number(model.folder_id),
    sort_order: Number(model.sort_order ?? 0) || 0,
  };
}

function normalizeFolder(folder: ProductModelFolder): ProductModelFolder {
  return {
    ...folder,
    parent_id:
      folder.parent_id == null || Number(folder.parent_id) <= 0
        ? null
        : Number(folder.parent_id),
    sort_order: Number(folder.sort_order ?? 0) || 0,
    default_sewing_operation_template_id:
      folder.default_sewing_operation_template_id == null ||
      Number(folder.default_sewing_operation_template_id) <= 0
        ? null
        : Number(folder.default_sewing_operation_template_id),
    default_sewing_operation_template_name:
      folder.default_sewing_operation_template_name?.trim() || null,
  };
}

export async function createProductModel(
  payload: ProductModelRequisitesInput,
): Promise<ProductModelCreateResult> {
  const article = payload.article.trim();
  const name = payload.name.trim();
  if (!article || !name) {
    return { ok: false, message: "Артикул и название обязательны" };
  }
  if (payload.size_grid_id == null) {
    return { ok: false, message: "Выберите размерную сетку" };
  }

  const response = await fetch(`${apiBaseUrl()}/product-models`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      article,
      name,
      size_type: payload.size_type,
      size_grid_id: payload.size_grid_id,
      description: payload.description?.trim() || null,
      ...(payload.folder_id !== undefined
        ? { folder_id: payload.folder_id }
        : {}),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }

  const model = normalizeProductModel((await response.json()) as ProductModel);
  revalidateModel(model.id);
  return { ok: true, model };
}

export async function updateProductModelRequisites(
  modelId: number,
  payload: ProductModelRequisitesInput,
): Promise<ProductModel> {
  const response = await fetch(`${apiBaseUrl()}/product-models/${modelId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      article: payload.article.trim(),
      name: payload.name.trim(),
      size_type: payload.size_type,
      description: payload.description?.trim() || null,
      ...(payload.size_grid_id !== undefined
        ? { size_grid_id: payload.size_grid_id }
        : {}),
      ...(payload.product_type_id !== undefined
        ? { product_type_id: payload.product_type_id }
        : {}),
      ...(payload.default_routing_template_id !== undefined
        ? { default_routing_template_id: payload.default_routing_template_id }
        : {}),
      ...(payload.patterns_path !== undefined
        ? { patterns_path: payload.patterns_path?.trim() || null }
        : {}),
      ...(payload.constructor_name !== undefined
        ? { constructor_name: payload.constructor_name?.trim() || null }
        : {}),
      ...(payload.patterns_created_on !== undefined
        ? {
            patterns_created_on: payload.patterns_created_on?.trim() || null,
          }
        : {}),
      ...(payload.folder_id !== undefined ? { folder_id: payload.folder_id } : {}),
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  const model = (await response.json()) as ProductModel;
  revalidateModel(model.id);
  return model;
}

export async function archiveProductModel(modelId: number): Promise<ProductModel> {
  const response = await fetch(`${apiBaseUrl()}/product-models/${modelId}/archive`, {
    method: "POST",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  const model = (await response.json()) as ProductModel;
  revalidateModel(model.id);
  return model;
}

export async function revertProductModelToDraft(modelId: number): Promise<ProductModel> {
  const response = await fetch(`${apiBaseUrl()}/product-models/${modelId}/draft`, {
    method: "POST",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  const model = (await response.json()) as ProductModel;
  revalidateModel(model.id);
  return model;
}

export async function activateProductModel(modelId: number): Promise<ProductModel> {
  const response = await fetch(`${apiBaseUrl()}/product-models/${modelId}/activate`, {
    method: "POST",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  const model = (await response.json()) as ProductModel;
  revalidateModel(model.id);
  return model;
}

export async function copyProductModel(modelId: number): Promise<ProductModel> {
  const response = await fetch(`${apiBaseUrl()}/product-models/${modelId}/copy`, {
    method: "POST",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  const model = (await response.json()) as ProductModel;
  revalidateModel(model.id);
  return model;
}

export async function uploadProductModelMedia(formData: FormData) {
  const modelId = String(formData.get("model_id") ?? "").trim();
  const makePrimary = String(formData.get("is_primary") ?? "") === "1";
  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!modelId) throw new Error("Не указана модель");
  if (files.length === 0) throw new Error(PRODUCT_MODEL_IMAGE_RULE);

  const uploaded: ProductModelMedia[] = [];
  for (const [index, file] of files.entries()) {
    const mime_type = validateImageFile(file);
    const content_base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const response = await fetch(`${apiBaseUrl()}/product-models/${modelId}/media`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        mime_type,
        content_base64,
        is_primary: makePrimary && index === 0,
      }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await readError(response));
    uploaded.push((await response.json()) as ProductModelMedia);
  }

  revalidateModel(modelId);
  return uploaded;
}

export async function replaceProductModelMedia(formData: FormData) {
  const modelId = String(formData.get("model_id") ?? "").trim();
  const mediaId = String(formData.get("media_id") ?? "").trim();
  const keepPrimary = String(formData.get("is_primary") ?? "") === "1";
  const file = formData.get("file");

  if (!modelId || !mediaId) throw new Error("Не указано изображение");
  if (!(file instanceof File)) throw new Error(PRODUCT_MODEL_IMAGE_RULE);
  const mime_type = validateImageFile(file);

  const content_base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const createResponse = await fetch(`${apiBaseUrl()}/product-models/${modelId}/media`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      mime_type,
      content_base64,
      is_primary: keepPrimary,
    }),
    cache: "no-store",
  });
  if (!createResponse.ok) throw new Error(await readError(createResponse));
  const created = (await createResponse.json()) as ProductModelMedia;

  const deleteResponse = await fetch(
    `${apiBaseUrl()}/product-models/${modelId}/media/${mediaId}`,
    {
      method: "DELETE",
      cache: "no-store",
    },
  );
  if (!deleteResponse.ok && deleteResponse.status !== 204) {
    throw new Error(await readError(deleteResponse));
  }

  revalidateModel(modelId);
  return created;
}

export async function deleteProductModelMedia(formData: FormData) {
  const modelId = String(formData.get("model_id") ?? "").trim();
  const mediaId = String(formData.get("media_id") ?? "").trim();
  if (!modelId || !mediaId) throw new Error("Не указано изображение");

  const response = await fetch(
    `${apiBaseUrl()}/product-models/${modelId}/media/${mediaId}`,
    {
      method: "DELETE",
      cache: "no-store",
    },
  );
  if (!response.ok && response.status !== 204) {
    throw new Error(await readError(response));
  }

  revalidateModel(modelId);
}

export async function setProductModelMediaPrimary(formData: FormData) {
  const modelId = String(formData.get("model_id") ?? "").trim();
  const mediaId = String(formData.get("media_id") ?? "").trim();
  if (!modelId || !mediaId) throw new Error("Не указано изображение");

  const response = await fetch(
    `${apiBaseUrl()}/product-models/${modelId}/media/${mediaId}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_primary: true }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error(await readError(response));

  const media = (await response.json()) as ProductModelMedia;
  revalidateModel(modelId);
  return media;
}

export type AssemblyActionResult =
  | { ok: true }
  | { ok: false; message: string };

export async function createAssemblyVariant(
  modelId: number,
  name: string,
  sewingOperationIds: number[] = [],
): Promise<AssemblyActionResult> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, message: "Укажите название варианта" };
  }
  if (sewingOperationIds.length === 0) {
    return { ok: false, message: "Выберите хотя бы одну операцию пошива" };
  }
  const response = await fetch(
    `${apiBaseUrl()}/product-models/${modelId}/assembly-variants`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: trimmed,
        sewing_operation_ids: sewingOperationIds,
        operation_lines: [],
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  revalidateModel(modelId);
  return { ok: true };
}

export async function updateAssemblyVariant(
  modelId: number,
  variantId: number,
  payload: { name?: string; is_active?: boolean },
): Promise<AssemblyActionResult> {
  const body: Record<string, unknown> = {};
  if (payload.name != null) body.name = payload.name.trim();
  if (payload.is_active != null) body.is_active = payload.is_active;
  const response = await fetch(
    `${apiBaseUrl()}/product-models/${modelId}/assembly-variants/${variantId}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  revalidateModel(modelId);
  return { ok: true };
}

export async function deleteAssemblyVariant(
  modelId: number,
  variantId: number,
): Promise<AssemblyActionResult> {
  const response = await fetch(
    `${apiBaseUrl()}/product-models/${modelId}/assembly-variants/${variantId}`,
    { method: "DELETE", cache: "no-store" },
  );
  if (!response.ok && response.status !== 204) {
    return { ok: false, message: await readError(response) };
  }
  revalidateModel(modelId);
  return { ok: true };
}

export async function copyAssemblyVariant(
  modelId: number,
  variantId: number,
): Promise<AssemblyActionResult> {
  const response = await fetch(
    `${apiBaseUrl()}/product-models/${modelId}/assembly-variants/${variantId}/copy`,
    { method: "POST", cache: "no-store" },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  revalidateModel(modelId);
  return { ok: true };
}

export async function addAssemblyVariantSewingOperations(
  modelId: number,
  variantId: number,
  sewingOperationIds: number[],
): Promise<AssemblyActionResult> {
  if (sewingOperationIds.length === 0) {
    return { ok: false, message: "Выберите хотя бы одну операцию пошива" };
  }
  const response = await fetch(
    `${apiBaseUrl()}/product-models/${modelId}/assembly-variants/${variantId}/sewing-operations`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sewing_operation_ids: sewingOperationIds }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  revalidateModel(modelId);
  return { ok: true };
}

export async function deleteAssemblyOperationLine(
  modelId: number,
  variantId: number,
  lineId: number,
): Promise<AssemblyActionResult> {
  const response = await fetch(
    `${apiBaseUrl()}/product-models/${modelId}/assembly-variants/${variantId}/operation-lines/${lineId}`,
    { method: "DELETE", cache: "no-store" },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  revalidateModel(modelId);
  return { ok: true };
}

export type RoutingActionResult =
  | { ok: true }
  | { ok: false; message: string };

export async function createProductModelRouting(
  modelId: number,
  shopRoutingTemplateId: number,
  norms: Array<{
    production_stage_id: number | null;
    tech_operation_id: number | null;
    norm_qty_per_item: string;
    unit: string;
  }> = [],
): Promise<RoutingActionResult> {
  const response = await fetch(
    `${apiBaseUrl()}/product-models/${modelId}/routings`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        shop_routing_template_id: shopRoutingTemplateId,
        norms,
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  revalidateModel(modelId);
  return { ok: true };
}

export async function updateProductModelRouting(
  modelId: number,
  linkId: number,
  payload: { is_active?: boolean; sort_order?: number },
): Promise<RoutingActionResult> {
  const response = await fetch(
    `${apiBaseUrl()}/product-models/${modelId}/routings/${linkId}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  revalidateModel(modelId);
  return { ok: true };
}

export async function deleteProductModelRouting(
  modelId: number,
  linkId: number,
): Promise<RoutingActionResult> {
  const response = await fetch(
    `${apiBaseUrl()}/product-models/${modelId}/routings/${linkId}`,
    { method: "DELETE", cache: "no-store" },
  );
  if (!response.ok && response.status !== 204) {
    return { ok: false, message: await readError(response) };
  }
  revalidateModel(modelId);
  return { ok: true };
}

export async function reorderProductModelRoutings(
  modelId: number,
  routingLinkIds: number[],
): Promise<RoutingActionResult> {
  const response = await fetch(
    `${apiBaseUrl()}/product-models/${modelId}/routings/reorder`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ routing_link_ids: routingLinkIds }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  revalidateModel(modelId);
  return { ok: true };
}

export async function replaceProductModelRoutingNorms(
  modelId: number,
  linkId: number,
  norms: Array<{
    production_stage_id: number | null;
    tech_operation_id: number | null;
    norm_qty_per_item: string;
    unit: string;
  }>,
): Promise<RoutingActionResult> {
  const response = await fetch(
    `${apiBaseUrl()}/product-models/${modelId}/routings/${linkId}/norms`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ norms }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  revalidateModel(modelId);
  return { ok: true };
}

export async function setProductModelDefaultRouting(
  modelId: number,
  defaultRoutingTemplateId: number | null,
): Promise<RoutingActionResult> {
  const response = await fetch(`${apiBaseUrl()}/product-models/${modelId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      default_routing_template_id: defaultRoutingTemplateId,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  revalidateModel(modelId);
  return { ok: true };
}

/** Catalog CSV/XLSX import (`POST /product-models/import`, `4.5.3`). */
export async function importProductModelsFile(
  formData: FormData,
): Promise<import("@/lib/product-model-import").ProductModelImportResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Выберите непустой файл CSV или XLSX.");
  }
  const dryRun = String(formData.get("dry_run") ?? "true") !== "false";
  const body = new FormData();
  body.append("file", file);

  const response = await fetch(
    `${apiBaseUrl()}/product-models/import?dry_run=${dryRun ? "true" : "false"}`,
    {
      method: "POST",
      body,
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const payload =
    (await response.json()) as import("@/lib/product-model-import").ProductModelImportResult;
  if (!dryRun && (payload.created_count > 0 || payload.updated_count > 0)) {
    revalidatePath("/settings/catalogs/product-models");
  }
  return payload;
}

async function fetchProductModelFileDownload(
  pathWithQuery: string,
): Promise<import("@/lib/file-download").FileDownloadPayload> {
  const response = await fetch(`${apiBaseUrl()}/product-models${pathWithQuery}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename="([^"]+)"/i.exec(disposition);
  const filename = match?.[1] ?? "product-model-download.bin";
  return {
    filename,
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
    base64: buffer.toString("base64"),
  };
}

/** Filter-aware catalog export (`GET /product-models/export`, `4.5.3`). */
export async function downloadProductModelExport(options?: {
  format?: "csv" | "xlsx";
  search?: string;
  status?: string;
  sizeType?: string;
  productTypeId?: number | null;
}): Promise<import("@/lib/file-download").FileDownloadPayload> {
  const params = new URLSearchParams();
  params.set("format", options?.format ?? "csv");
  if (options?.search?.trim()) params.set("search", options.search.trim());
  if (options?.status) params.set("status", options.status);
  if (options?.sizeType) params.set("size_type", options.sizeType);
  if (options?.productTypeId != null) {
    params.set("product_type_id", String(options.productTypeId));
  }
  return fetchProductModelFileDownload(`/export?${params.toString()}`);
}

/** Import template — same columns as export. */
export async function downloadProductModelImportTemplate(
  format: "csv" | "xlsx" = "csv",
): Promise<import("@/lib/file-download").FileDownloadPayload> {
  return fetchProductModelFileDownload(
    `/import-template?format=${encodeURIComponent(format)}`,
  );
}

export type ProductModelFolderActionResult =
  | { ok: true; folder: ProductModelFolder }
  | { ok: false; message: string };

export type ProductModelMoveResult =
  | { ok: true; model: ProductModel }
  | { ok: false; message: string };

export async function createProductModelFolder(input: {
  name: string;
  parent_id: number | null;
}): Promise<ProductModelFolderActionResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Укажите название папки" };
  const response = await fetch(`${apiBaseUrl()}/product-model-folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, parent_id: input.parent_id }),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const folder = normalizeFolder((await response.json()) as ProductModelFolder);
  revalidatePath("/settings/catalogs/product-models");
  return { ok: true, folder };
}

export async function updateProductModelFolder(
  folderId: number,
  input: {
    name?: string;
    parent_id?: number | null;
    default_sewing_operation_template_id?: number | null;
  },
): Promise<ProductModelFolderActionResult> {
  const body: Record<string, unknown> = {};
  if (input.name != null) body.name = input.name.trim();
  if ("parent_id" in input) body.parent_id = input.parent_id ?? null;
  if ("default_sewing_operation_template_id" in input) {
    body.default_sewing_operation_template_id =
      input.default_sewing_operation_template_id ?? null;
  }
  const response = await fetch(
    `${apiBaseUrl()}/product-model-folders/${folderId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const folder = normalizeFolder((await response.json()) as ProductModelFolder);
  revalidatePath("/settings/catalogs/product-models");
  return { ok: true, folder };
}

export async function deleteProductModelFolder(
  folderId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(
    `${apiBaseUrl()}/product-model-folders/${folderId}`,
    { method: "DELETE", cache: "no-store" },
  );
  if (!response.ok && response.status !== 204) {
    return { ok: false, message: await readError(response) };
  }
  revalidatePath("/settings/catalogs/product-models");
  return { ok: true };
}

export async function moveProductModelFolderSibling(
  folderId: number,
  direction: "up" | "down",
): Promise<ProductModelFolderActionResult> {
  const response = await fetch(
    `${apiBaseUrl()}/product-model-folders/${folderId}/move-sibling`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const folder = normalizeFolder((await response.json()) as ProductModelFolder);
  revalidatePath("/settings/catalogs/product-models");
  return { ok: true, folder };
}

export async function moveProductModelToFolder(
  modelId: number,
  folderId: number | null,
): Promise<ProductModelMoveResult> {
  const response = await fetch(`${apiBaseUrl()}/product-models/${modelId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder_id: folderId }),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const model = normalizeProductModel((await response.json()) as ProductModel);
  revalidateModel(model.id);
  return { ok: true, model };
}

export async function moveProductModelsToFolder(
  modelIds: number[],
  folderId: number | null,
): Promise<{ ok: true; models: ProductModel[] } | { ok: false; message: string }> {
  const uniqueIds = [...new Set(modelIds)].filter(
    (id) => Number.isSafeInteger(id) && id > 0,
  );
  if (uniqueIds.length === 0) {
    return { ok: false, message: "Выберите хотя бы одну модель" };
  }
  const models: ProductModel[] = [];
  for (const modelId of uniqueIds) {
    const result = await moveProductModelToFolder(modelId, folderId);
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    models.push(result.model);
  }
  revalidatePath("/settings/catalogs/product-models");
  return { ok: true, models };
}
