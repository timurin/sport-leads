"use server";

import { revalidatePath } from "next/cache";

import {
  fromApiNomenclature,
  type ApiNomenclature,
  type Nomenclature,
  type NomenclatureRequisitesDraft,
  type NomenclatureType,
} from "@/lib/nomenclature";
import type { NomenclatureImportResult } from "@/lib/nomenclature-import";
import type { FileDownloadPayload } from "@/lib/file-download";

const apiBaseUrl = () => (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

async function readDetail(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | { detail?: string | Array<{ msg?: string }> }
    | null;
  if (typeof payload?.detail === "string") return payload.detail;
  if (Array.isArray(payload?.detail) && payload.detail.length > 0) {
    return (
      payload.detail.map((item) => item.msg).filter(Boolean).join("; ") ||
      `Backend вернул ${response.status}.`
    );
  }
  return `Backend вернул ${response.status}.`;
}

async function mutate(path: string, method: string, body: Record<string, unknown>) {
  const response = await fetch(`${apiBaseUrl()}/nomenclatures${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readDetail(response));
  }
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  return (await response.json()) as ApiNomenclature;
}

export async function createNomenclature(formData: FormData) {
  await mutate("", "POST", {
    name: text(formData, "name"),
    short_name: text(formData, "short_name") || null,
    description: text(formData, "description") || null,
    category: text(formData, "category") || "Без категории",
    category_id: formData.get("category_id") ? Number(formData.get("category_id")) : null,
    nomenclature_type: text(formData, "nomenclature_type") || "PRODUCT",
    unit: text(formData, "unit") || "шт",
    storage_unit_id: formData.get("storage_unit_id") ? Number(formData.get("storage_unit_id")) : null,
    base_price: text(formData, "base_price") || "0",
    currency: text(formData, "currency") || "RUB",
  });
  revalidatePath("/settings/catalogs/nomenclature");
  revalidatePath("/warehouse/stock");
}

/** Duplicate nomenclature master card (`POST /nomenclatures/{id}/copy`). */
export async function copyNomenclature(nomenclatureId: number): Promise<Nomenclature> {
  const created = await mutate(`/${nomenclatureId}/copy`, "POST", {});
  if (!created) {
    throw new Error("Backend не вернул скопированную номенклатуру.");
  }
  const item = fromApiNomenclature(created);
  revalidatePath("/settings/catalogs/nomenclature");
  revalidatePath("/warehouse/stock");
  revalidatePath(`/settings/catalogs/nomenclature/${item.id}`);
  return item;
}

export async function updateNomenclature(formData: FormData) {
  const id = text(formData, "id");
  await mutate(`/${id}`, "PATCH", {
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
  revalidatePath(`/settings/catalogs/nomenclature/${id}`);
  revalidatePath("/warehouse/stock");
}

/** PT-08 card requisites save — returns persisted row (no FormData free-text category/unit). */
export async function updateNomenclatureRequisites(
  nomenclatureId: number,
  draft: NomenclatureRequisitesDraft & {
    category: string;
    unit: string;
  },
): Promise<Nomenclature> {
  const updated = await mutate(`/${nomenclatureId}`, "PATCH", {
    name: draft.name.trim(),
    short_name: draft.short_name.trim() || null,
    description: draft.description.trim() || null,
    category: draft.category.trim() || "Без категории",
    category_id: draft.category_id,
    nomenclature_type: draft.nomenclature_type as NomenclatureType,
    product_type_id:
      draft.nomenclature_type === "PRODUCT" ? draft.product_type_id : null,
    unit: draft.unit.trim() || "шт",
    storage_unit_id: draft.storage_unit_id,
    base_price: draft.base_price.trim() || "0",
    currency: draft.currency.trim() || "RUB",
    is_active: draft.is_active,
  });
  if (!updated) {
    throw new Error("Backend не вернул карточку номенклатуры.");
  }
  revalidatePath("/settings/catalogs/nomenclature");
  revalidatePath(`/settings/catalogs/nomenclature/${nomenclatureId}`);
  return fromApiNomenclature(updated);
}

/** Soft archive / restore — only `is_active` (roadmap 4.3.3.4 bulk). */
export async function setNomenclatureActive(
  nomenclatureId: number,
  isActive: boolean,
): Promise<Nomenclature> {
  const updated = await mutate(`/${nomenclatureId}`, "PATCH", {
    is_active: isActive,
  });
  if (!updated) {
    throw new Error("Backend не вернул карточку номенклатуры.");
  }
  revalidatePath("/settings/catalogs/nomenclature");
  revalidatePath(`/settings/catalogs/nomenclature/${nomenclatureId}`);
  revalidatePath("/warehouse/stock");
  return fromApiNomenclature(updated);
}

export async function bulkSetNomenclatureActive(
  nomenclatureIds: number[],
  isActive: boolean,
): Promise<{ updated_count: number }> {
  const uniqueIds = [...new Set(nomenclatureIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (uniqueIds.length === 0) {
    return { updated_count: 0 };
  }
  let updatedCount = 0;
  const errors: string[] = [];
  for (const id of uniqueIds) {
    try {
      await setNomenclatureActive(id, isActive);
      updatedCount += 1;
    } catch (caught) {
      errors.push(
        `#${id}: ${caught instanceof Error ? caught.message : "ошибка"}`,
      );
    }
  }
  if (errors.length > 0) {
    throw new Error(
      `Обновлено ${updatedCount} из ${uniqueIds.length}. ${errors.slice(0, 3).join("; ")}`,
    );
  }
  return { updated_count: updatedCount };
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
  const body: Record<string, unknown> = {
    is_active: formData.get("is_active") === "true",
  };
  const name = text(formData, "name");
  const symbol = text(formData, "symbol");
  const unitCategory = text(formData, "unit_category");
  const precisionRaw = formData.get("precision");
  if (name) body.name = name;
  if (symbol) body.symbol = symbol;
  if (unitCategory) body.unit_category = unitCategory;
  if (precisionRaw != null && String(precisionRaw) !== "") {
    body.precision = Number(precisionRaw);
  }
  await mutate(`/units-of-measure/${id}`, "PATCH", body);
  revalidatePath("/settings/catalogs/units-of-measure");
}

export async function createNomenclatureCategory(formData: FormData) {
  const parentRaw = formData.get("parent_id");
  const parentId =
    parentRaw != null && String(parentRaw).trim() !== ""
      ? Number(parentRaw)
      : null;
  await mutate("/categories", "POST", {
    parent_id: parentId,
    name: text(formData, "name"),
    code: text(formData, "code"),
    description: text(formData, "description") || null,
    nomenclature_type: text(formData, "nomenclature_type") || "PRODUCT",
    sort_order: Number(formData.get("sort_order") ?? 0),
  });
  revalidatePath("/settings/catalogs/nomenclature");
  revalidatePath("/settings/catalogs/nomenclature-categories");
  revalidatePath("/warehouse/stock");
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
  revalidatePath("/settings/catalogs/nomenclature-categories");
  revalidatePath("/warehouse/stock");
}

/** Sibling ↑/↓ reorder — dense sort_order 0..n-1 under the same parent. */
export async function reorderNomenclatureCategorySibling(
  categoryId: number,
  direction: -1 | 1,
) {
  const { getNomenclatureCategories } = await import("@/lib/nomenclature");
  const { planSiblingReorder } = await import(
    "@/lib/nomenclature-category-tree"
  );
  const categories = await getNomenclatureCategories();
  const target = categories.find((item) => item.id === categoryId);
  if (!target) {
    throw new Error("Категория не найдена.");
  }
  const siblings = categories.filter(
    (item) => item.parent_id === target.parent_id,
  );
  const plan = planSiblingReorder(siblings, categoryId, direction);
  if (!plan) {
    return;
  }
  const byId = new Map(siblings.map((item) => [item.id, item] as const));
  for (const row of plan) {
    const current = byId.get(row.id);
    if (!current || current.sort_order === row.sort_order) continue;
    await mutate(`/categories/${row.id}`, "PATCH", {
      sort_order: row.sort_order,
    });
  }
  revalidatePath("/settings/catalogs/nomenclature");
  revalidatePath("/settings/catalogs/nomenclature-categories");
  revalidatePath("/warehouse/stock");
}

function revalidateNomenclatureCard(nomenclatureId: number) {
  revalidatePath("/settings/catalogs/nomenclature");
  revalidatePath(`/settings/catalogs/nomenclature/${nomenclatureId}`);
}

export async function addNomenclatureAvailableModel(
  nomenclatureId: number,
  productModelId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(
    `${apiBaseUrl()}/nomenclatures/${nomenclatureId}/available-models`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ product_model_id: productModelId }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readDetail(response) };
  }
  revalidateNomenclatureCard(nomenclatureId);
  return { ok: true };
}

export async function removeNomenclatureAvailableModel(
  nomenclatureId: number,
  productModelId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(
    `${apiBaseUrl()}/nomenclatures/${nomenclatureId}/available-models/${productModelId}`,
    { method: "DELETE", cache: "no-store" },
  );
  if (!response.ok && response.status !== 204) {
    return { ok: false, message: await readDetail(response) };
  }
  revalidateNomenclatureCard(nomenclatureId);
  return { ok: true };
}

/** Catalog CSV/XLSX import (`POST /nomenclatures/import`, `4.5.1.2` / `4.5.1.3`). */
export async function importNomenclaturesFile(
  formData: FormData,
): Promise<NomenclatureImportResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Выберите непустой файл CSV или XLSX.");
  }
  const dryRun = String(formData.get("dry_run") ?? "true") !== "false";
  const body = new FormData();
  body.append("file", file);

  const response = await fetch(
    `${apiBaseUrl()}/nomenclatures/import?dry_run=${dryRun ? "true" : "false"}`,
    {
      method: "POST",
      body,
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(await readDetail(response));
  }
  const payload = (await response.json()) as NomenclatureImportResult;
  if (!dryRun && payload.created_count > 0) {
    revalidatePath("/settings/catalogs/nomenclature");
    revalidatePath("/warehouse/stock");
  }
  return payload;
}

async function fetchNomenclatureFileDownload(
  pathWithQuery: string,
): Promise<FileDownloadPayload> {
  const response = await fetch(`${apiBaseUrl()}/nomenclatures${pathWithQuery}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readDetail(response));
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename="([^"]+)"/i.exec(disposition);
  const filename = match?.[1] ?? "nomenclature-download.bin";
  return {
    filename,
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
    base64: buffer.toString("base64"),
  };
}

/** Filter-aware catalog export (`GET /nomenclatures/export`, `4.5.2`). */
export async function downloadNomenclatureExport(options?: {
  format?: "csv" | "xlsx";
  search?: string;
  isActive?: boolean | null;
  nomenclatureType?: string;
}): Promise<FileDownloadPayload> {
  const params = new URLSearchParams();
  params.set("format", options?.format ?? "csv");
  if (options?.search?.trim()) params.set("search", options.search.trim());
  if (options?.isActive === true) params.set("is_active", "true");
  if (options?.isActive === false) params.set("is_active", "false");
  if (options?.nomenclatureType) {
    params.set("nomenclature_type", options.nomenclatureType);
  }
  return fetchNomenclatureFileDownload(`/export?${params.toString()}`);
}

/** Import template — same columns as export (`GET /nomenclatures/import-template`). */
export async function downloadNomenclatureImportTemplate(
  format: "csv" | "xlsx" = "csv",
): Promise<FileDownloadPayload> {
  return fetchNomenclatureFileDownload(
    `/import-template?format=${encodeURIComponent(format)}`,
  );
}
