"use server";

import { revalidatePath } from "next/cache";

const base = () => (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const value = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

async function request(path: string, method: string, body: unknown) {
  const response = await fetch(`${base()}/custom-fields${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  if (!response.ok) { const payload = await response.json().catch(() => null) as { detail?: string } | null; throw new Error(payload?.detail ?? `Backend вернул ${response.status}.`); }
}

export async function createCustomField(formData: FormData) {
  await request("", "POST", { code: value(formData, "code"), name: value(formData, "name"), data_type: value(formData, "data_type"), description: value(formData, "description") || null, is_searchable: formData.get("is_searchable") === "on", is_filterable: formData.get("is_filterable") === "on" });
  revalidatePath("/settings/catalogs/custom-fields");
}

export async function updateCustomFieldStatus(formData: FormData) {
  await request(`/${value(formData, "id")}`, "PATCH", { is_active: formData.get("is_active") === "true" });
  revalidatePath("/settings/catalogs/custom-fields");
}

export async function assignCustomFieldToCategory(formData: FormData) {
  await request(`/categories/${value(formData, "category_id")}/fields`, "POST", { field_definition_id: Number(formData.get("field_definition_id")), is_required: formData.get("is_required") === "on", inherit: formData.get("inherit") !== "off", sort_order: Number(formData.get("sort_order") ?? 0) });
  revalidatePath("/settings/catalogs/custom-fields");
}

export async function saveNomenclatureCustomField(formData: FormData) {
  const dataType = value(formData, "data_type");
  const raw = String(formData.get("value") ?? "");
  let fieldValue: unknown = raw === "" ? null : raw;
  if (dataType === "INTEGER") fieldValue = raw === "" ? null : Number.parseInt(raw, 10);
  if (dataType === "DECIMAL") fieldValue = raw === "" ? null : raw;
  if (dataType === "BOOLEAN") fieldValue = formData.get("value") === "on";
  if (dataType === "MULTI_SELECT") fieldValue = raw ? raw.split(",").filter(Boolean).map(Number) : [];
  await request(`/nomenclatures/${value(formData, "nomenclature_id")}/fields`, "PUT", [{ field_definition_id: Number(formData.get("field_definition_id")), value: fieldValue }]);
  revalidatePath("/settings/catalogs/nomenclature");
}

export async function assignNomenclatureCustomField(formData: FormData) {
  await request(`/nomenclatures/${value(formData, "nomenclature_id")}/fields`, "POST", { field_definition_id: Number(formData.get("field_definition_id")) });
  revalidatePath(`/settings/catalogs/nomenclature/${value(formData, "nomenclature_id")}`);
}

export async function createAndAssignNomenclatureCustomField(formData: FormData) {
  const nomenclatureId = value(formData, "nomenclature_id");
  const response = await fetch(`${base()}/custom-fields`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: value(formData, "name"), data_type: value(formData, "data_type") }), cache: "no-store" });
  if (!response.ok) { const payload = await response.json().catch(() => null) as { detail?: string } | null; throw new Error(payload?.detail ?? `Backend вернул ${response.status}.`); }
  const definition = await response.json() as { id: number };
  await request(`/nomenclatures/${nomenclatureId}/fields`, "POST", { field_definition_id: definition.id });
  revalidatePath(`/settings/catalogs/nomenclature/${nomenclatureId}`);
}

export async function removeNomenclatureCustomField(formData: FormData) {
  const nomenclatureId = value(formData, "nomenclature_id");
  await request(`/nomenclatures/${nomenclatureId}/fields/${value(formData, "field_definition_id")}`, "DELETE", undefined);
  revalidatePath(`/settings/catalogs/nomenclature/${nomenclatureId}`);
}
