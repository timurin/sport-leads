"use server";

import {
  parseSortOrder,
  validateProductTypeDraft,
  type ProductType,
  type ProductTypeDraft,
} from "@/lib/product-types";

export type ProductTypeActionResult =
  | { ok: true; productType: ProductType }
  | { ok: false; message: string };

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string | unknown };
    if (typeof body.detail === "string" && body.detail.trim()) {
      return body.detail;
    }
  } catch {
    /* ignore */
  }
  return `Ошибка API (${response.status})`;
}

function draftPayload(draft: ProductTypeDraft) {
  const sortOrder = parseSortOrder(draft.sort_order);
  if (sortOrder == null) {
    return null;
  }
  return {
    name: draft.name.trim(),
    is_active: draft.is_active,
    sort_order: sortOrder,
  };
}

export async function createProductType(
  draft: ProductTypeDraft,
): Promise<ProductTypeActionResult> {
  const validationError = validateProductTypeDraft(draft);
  if (validationError) {
    return { ok: false, message: validationError };
  }
  const payload = draftPayload(draft);
  if (payload == null) {
    return { ok: false, message: "Порядок сортировки — целое число ≥ 0" };
  }

  const response = await fetch(`${apiBaseUrl()}/product-types`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  return {
    ok: true,
    productType: (await response.json()) as ProductType,
  };
}

export async function updateProductType(
  productTypeId: number,
  draft: ProductTypeDraft,
): Promise<ProductTypeActionResult> {
  const validationError = validateProductTypeDraft(draft);
  if (validationError) {
    return { ok: false, message: validationError };
  }
  const payload = draftPayload(draft);
  if (payload == null) {
    return { ok: false, message: "Порядок сортировки — целое число ≥ 0" };
  }

  const response = await fetch(
    `${apiBaseUrl()}/product-types/${productTypeId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  return {
    ok: true,
    productType: (await response.json()) as ProductType,
  };
}

export async function deleteProductType(
  productTypeId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(
    `${apiBaseUrl()}/product-types/${productTypeId}`,
    { method: "DELETE", cache: "no-store" },
  );
  if (!response.ok && response.status !== 204) {
    return { ok: false, message: await readError(response) };
  }
  return { ok: true };
}
