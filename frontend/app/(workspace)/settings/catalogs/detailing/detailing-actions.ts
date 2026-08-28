"use server";

import { revalidatePath } from "next/cache";

import {
  validateDetailingDraft,
  type DetailingItem,
  type DetailingItemDraft,
} from "@/lib/detailing";

export type DetailingActionResult =
  | { ok: true; item: DetailingItem }
  | { ok: false; message: string };

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
  } catch {
    /* ignore */
  }
  return `Ошибка API (${response.status})`;
}

function revalidate() {
  revalidatePath("/settings/catalogs/detailing");
  revalidatePath("/settings/catalogs/product-models");
}

export async function createDetailingItem(
  draft: DetailingItemDraft,
): Promise<DetailingActionResult> {
  const error = validateDetailingDraft(draft);
  if (error) return { ok: false, message: error };
  const response = await fetch(`${apiBaseUrl()}/detailing-items`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: draft.name.trim(),
      applicability_product_type_ids: draft.applicability_product_type_ids,
    }),
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, message: await readError(response) };
  const item = (await response.json()) as DetailingItem;
  revalidate();
  return { ok: true, item };
}

export async function updateDetailingItem(
  itemId: number,
  draft: DetailingItemDraft,
): Promise<DetailingActionResult> {
  const error = validateDetailingDraft(draft);
  if (error) return { ok: false, message: error };
  const response = await fetch(`${apiBaseUrl()}/detailing-items/${itemId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: draft.name.trim(),
      applicability_product_type_ids: draft.applicability_product_type_ids,
    }),
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, message: await readError(response) };
  const item = (await response.json()) as DetailingItem;
  revalidate();
  return { ok: true, item };
}

export async function deleteDetailingItem(
  itemId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(`${apiBaseUrl()}/detailing-items/${itemId}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!response.ok && response.status !== 204) {
    return { ok: false, message: await readError(response) };
  }
  revalidate();
  return { ok: true };
}
