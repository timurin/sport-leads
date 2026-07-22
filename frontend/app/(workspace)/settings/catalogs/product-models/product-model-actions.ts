"use server";

import { revalidatePath } from "next/cache";

import {
  PRODUCT_MODEL_IMAGE_MAX_BYTES,
  PRODUCT_MODEL_IMAGE_RULE,
  type ProductModel,
  type ProductModelMedia,
  type ProductModelSizeType,
} from "@/lib/product-models";

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

function validateImageFile(file: File): void {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error(PRODUCT_MODEL_IMAGE_RULE);
  }
  if (file.size > PRODUCT_MODEL_IMAGE_MAX_BYTES) {
    throw new Error(PRODUCT_MODEL_IMAGE_RULE);
  }
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(file.type)) {
    throw new Error(PRODUCT_MODEL_IMAGE_RULE);
  }
}

export type ProductModelRequisitesInput = {
  article: string;
  name: string;
  size_type: ProductModelSizeType;
  description: string | null;
};

export type ProductModelCreateResult =
  | { ok: true; model: ProductModel }
  | { ok: false; message: string };

export async function createProductModel(
  payload: ProductModelRequisitesInput,
): Promise<ProductModelCreateResult> {
  const article = payload.article.trim();
  const name = payload.name.trim();
  if (!article || !name) {
    return { ok: false, message: "Артикул и название обязательны" };
  }

  const response = await fetch(`${apiBaseUrl()}/product-models`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      article,
      name,
      size_type: payload.size_type,
      description: payload.description?.trim() || null,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }

  const model = (await response.json()) as ProductModel;
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
    validateImageFile(file);
    const content_base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const response = await fetch(`${apiBaseUrl()}/product-models/${modelId}/media`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        mime_type: file.type,
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
  validateImageFile(file);

  const content_base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const createResponse = await fetch(`${apiBaseUrl()}/product-models/${modelId}/media`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      mime_type: file.type,
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
