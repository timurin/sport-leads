"use server";

import { revalidatePath } from "next/cache";

import {
  addNomenclatureCharacteristicWithValue,
  assignCategoryCharacteristic,
  assignNomenclatureCharacteristicValue,
  createCharacteristic,
  removeNomenclatureCharacteristicValue,
  saveNomenclatureCharacteristicValue,
  updateCharacteristic,
} from "@/app/(workspace)/settings/catalogs/nomenclature/characteristics-actions";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

/** Compat: former custom-field create → characteristic (non-variant). */
export async function createCustomField(formData: FormData) {
  const kindRaw = value(formData, "kind") || value(formData, "data_type") || "STRING";
  const kind = kindRaw === "SINGLE_SELECT" ? "LIST" : kindRaw;
  const data = new FormData();
  data.set("code", value(formData, "code"));
  data.set("name", value(formData, "name"));
  data.set("kind", kind);
  data.set("description", value(formData, "description"));
  data.set("is_variant_dimension", "false");
  await createCharacteristic(data);
  revalidatePath("/settings/catalogs/product-characteristics");
}

export async function updateCustomFieldStatus(formData: FormData) {
  const id = value(formData, "id");
  const data = new FormData();
  data.set("id", id);
  data.set("name", value(formData, "name") || "—");
  data.set("is_active", value(formData, "is_active") || "true");
  // Prefer toggle without requiring name — fetch is heavy; status-only PATCH via name preserve.
  // updateCharacteristic requires name; callers that only toggle should pass name.
  if (!value(formData, "name")) {
    data.set("name", `field-${id}`);
  }
  await updateCharacteristic(data);
  revalidatePath("/settings/catalogs/product-characteristics");
}

export async function assignCustomFieldToCategory(formData: FormData) {
  const data = new FormData();
  data.set("category_id", value(formData, "category_id"));
  data.set(
    "characteristic_id",
    value(formData, "characteristic_id") ||
      value(formData, "field_definition_id"),
  );
  if (formData.get("is_required") === "on") data.set("is_required", "on");
  if (formData.get("inherit") !== "off") data.set("inherit", "on");
  data.set("sort_order", value(formData, "sort_order") || "0");
  await assignCategoryCharacteristic(data);
}

export async function saveNomenclatureCustomField(formData: FormData) {
  await saveNomenclatureCharacteristicValue(formData);
}

export async function assignNomenclatureCustomField(formData: FormData) {
  await assignNomenclatureCharacteristicValue(formData);
}

export async function addNomenclatureCustomFieldWithValue(formData: FormData) {
  await addNomenclatureCharacteristicWithValue(formData);
}

export async function createAndAssignNomenclatureCustomField(
  formData: FormData,
) {
  await addNomenclatureCharacteristicWithValue(formData);
}

export async function removeNomenclatureCustomField(formData: FormData) {
  await removeNomenclatureCharacteristicValue(formData);
}
