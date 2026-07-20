"use server";

import { revalidatePath } from "next/cache";

const apiBaseUrl = () => (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

async function mutate(path: string, method: string, body: Record<string, unknown>) {
  const response = await fetch(`${apiBaseUrl()}/nomenclatures${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(payload?.detail ?? `Backend вернул ${response.status}.`);
  }
}

export async function createNomenclature(formData: FormData) {
  await mutate("", "POST", {
    article: text(formData, "article"),
    name: text(formData, "name"),
    short_name: text(formData, "short_name") || null,
    description: text(formData, "description") || null,
    category: text(formData, "category"),
    category_id: formData.get("category_id") ? Number(formData.get("category_id")) : null,
    nomenclature_type: text(formData, "nomenclature_type") || "PRODUCT",
    unit: text(formData, "unit") || "шт",
    storage_unit_id: formData.get("storage_unit_id") ? Number(formData.get("storage_unit_id")) : null,
    base_price: text(formData, "base_price") || "0",
    currency: text(formData, "currency") || "RUB",
  });
  revalidatePath("/settings/catalogs/nomenclature");
}

export async function updateNomenclature(formData: FormData) {
  const id = text(formData, "id");
  await mutate(`/${id}`, "PATCH", {
    article: text(formData, "article"),
    name: text(formData, "name"),
    short_name: text(formData, "short_name") || null,
    description: text(formData, "description") || null,
    category: text(formData, "category"),
    category_id: formData.get("category_id") ? Number(formData.get("category_id")) : null,
    nomenclature_type: text(formData, "nomenclature_type") || "PRODUCT",
    unit: text(formData, "unit") || "шт",
    storage_unit_id: formData.get("storage_unit_id") ? Number(formData.get("storage_unit_id")) : null,
    base_price: text(formData, "base_price") || "0",
    currency: text(formData, "currency") || "RUB",
    is_active: formData.get("is_active") === "true",
  });
  revalidatePath("/settings/catalogs/nomenclature");
}

export async function createUnitOfMeasure(formData: FormData) {
  await mutate("/units-of-measure", "POST", {
    code: text(formData, "code"), name: text(formData, "name"), symbol: text(formData, "symbol"),
    unit_category: text(formData, "unit_category"), precision: Number(formData.get("precision") ?? 0),
  });
  revalidatePath("/settings/catalogs/units-of-measure");
}

export async function updateUnitOfMeasure(formData: FormData) {
  const id = text(formData, "id");
  await mutate(`/units-of-measure/${id}`, "PATCH", { is_active: formData.get("is_active") === "true" });
  revalidatePath("/settings/catalogs/units-of-measure");
}

export async function createNomenclatureCategory(formData: FormData) {
  await mutate("/categories", "POST", {
    parent_id: formData.get("parent_id") ? Number(formData.get("parent_id")) : null,
    name: text(formData, "name"),
    code: text(formData, "code"),
    description: text(formData, "description") || null,
    nomenclature_type: text(formData, "nomenclature_type") || "PRODUCT",
    sort_order: Number(formData.get("sort_order") ?? 0),
  });
  revalidatePath("/settings/catalogs/nomenclature");
}

export async function updateNomenclatureCategory(formData: FormData) {
  const id = text(formData, "id");
  await mutate(`/categories/${id}`, "PATCH", {
    parent_id: formData.get("parent_id") ? Number(formData.get("parent_id")) : null,
    name: text(formData, "name"), code: text(formData, "code"), description: text(formData, "description") || null,
    nomenclature_type: text(formData, "nomenclature_type") || "PRODUCT", sort_order: Number(formData.get("sort_order") ?? 0),
    is_active: formData.get("is_active") === "true",
  });
  revalidatePath("/settings/catalogs/nomenclature");
}
