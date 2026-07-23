"use server";

import { revalidatePath } from "next/cache";

import type { NomenclatureMedia } from "@/lib/nomenclature";

const apiBase = () =>
  (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const base = () => `${apiBase()}/characteristics`;
const mediaBase = () => apiBase();

async function request(path: string, method: string, body?: unknown) {
  const response = await fetch(`${base()}${path}`, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(data?.detail ?? `Backend вернул ${response.status}`);
  }
  if (response.status === 204) {
    return null;
  }
  const text = await response.text();
  return text ? (JSON.parse(text) as unknown) : null;
}

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createCharacteristic(formData: FormData) {
  await request("/definitions", "POST", {
    code: value(formData, "code") || null,
    name: value(formData, "name"),
    kind: value(formData, "kind") || "LIST",
    description: value(formData, "description") || null,
    is_variant_dimension: formData.get("is_variant_dimension") === "true",
  });
  revalidatePath("/settings/catalogs/product-characteristics");
}

export async function updateCharacteristic(formData: FormData) {
  const id = value(formData, "id");
  await request(`/definitions/${id}`, "PATCH", {
    name: value(formData, "name"),
    is_active: formData.get("is_active") === "true",
  });
  revalidatePath("/settings/catalogs/product-characteristics");
  revalidatePath(`/settings/catalogs/product-characteristics/${id}`);
}

export async function deleteCharacteristic(formData: FormData) {
  const id = value(formData, "id");
  await request(`/definitions/${id}`, "DELETE");
  revalidatePath("/settings/catalogs/product-characteristics");
}

export async function createCharacteristicOption(formData: FormData) {
  const characteristicId = value(formData, "characteristic_id");
  await request(`/definitions/${characteristicId}/options`, "POST", {
    code: value(formData, "code"),
    label: value(formData, "label"),
    hex_value: value(formData, "hex_value") || null,
    sort_order: Number(formData.get("sort_order") ?? 0),
  });
  revalidatePath(
    `/settings/catalogs/product-characteristics/${characteristicId}`,
  );
}

export async function updateCharacteristicOption(formData: FormData) {
  const characteristicId = value(formData, "characteristic_id");
  await request(`/options/${value(formData, "id")}`, "PATCH", {
    label: value(formData, "label"),
    sort_order: Number(formData.get("sort_order") ?? 0),
    hex_value: value(formData, "hex_value") || null,
    is_active: formData.get("is_active") === "true",
  });
  revalidatePath(
    `/settings/catalogs/product-characteristics/${characteristicId}`,
  );
}

export async function deleteCharacteristicOption(formData: FormData) {
  const characteristicId = value(formData, "characteristic_id");
  await request(`/options/${value(formData, "id")}`, "DELETE");
  revalidatePath(
    `/settings/catalogs/product-characteristics/${characteristicId}`,
  );
}

export async function assignCategoryCharacteristic(formData: FormData) {
  await request(`/categories/${value(formData, "category_id")}`, "POST", {
    characteristic_id: Number(formData.get("characteristic_id")),
    is_required: formData.get("is_required") === "on",
    inherit: formData.get("inherit") !== "off",
    sort_order: Number(formData.get("sort_order") ?? 0),
  });
  revalidatePath("/settings/catalogs/product-characteristics");
}

export async function saveNomenclatureCharacteristicValue(formData: FormData) {
  const nomenclatureId = value(formData, "nomenclature_id");
  const kind = value(formData, "kind") || value(formData, "data_type");
  const raw = value(formData, "value");
  let fieldValue: unknown = raw;
  if (kind === "BOOLEAN") fieldValue = raw === "true";
  else if (kind === "INTEGER") fieldValue = raw === "" ? null : Number(raw);
  else if (kind === "DECIMAL") fieldValue = raw === "" ? null : raw;
  else if (kind === "LIST" || kind === "SINGLE_SELECT" || kind === "COLOR") {
    fieldValue = raw === "" ? null : Number(raw);
  } else if (raw === "") fieldValue = null;
  await request(`/nomenclatures/${nomenclatureId}/values`, "PUT", [
    {
      characteristic_id: Number(
        formData.get("characteristic_id") ?? formData.get("field_definition_id"),
      ),
      value: fieldValue,
    },
  ]);
  revalidatePath(`/settings/catalogs/nomenclature/${nomenclatureId}`);
}

export async function assignNomenclatureCharacteristicValue(formData: FormData) {
  const nomenclatureId = value(formData, "nomenclature_id");
  await request(`/nomenclatures/${nomenclatureId}/values`, "POST", {
    characteristic_id: Number(
      formData.get("characteristic_id") ?? formData.get("field_definition_id"),
    ),
  });
  revalidatePath(`/settings/catalogs/nomenclature/${nomenclatureId}`);
}

export async function addNomenclatureCharacteristicWithValue(formData: FormData) {
  const nomenclatureId = value(formData, "nomenclature_id");
  const name = value(formData, "name");
  let characteristicId = Number(
    formData.get("characteristic_id") || formData.get("field_definition_id") || 0,
  );
  let kind = value(formData, "kind") || value(formData, "data_type") || "STRING";

  if (!characteristicId && name) {
    const searchResponse = await fetch(
      `${base()}/definitions?search=${encodeURIComponent(name)}&is_active=true`,
      { cache: "no-store" },
    );
    if (searchResponse.ok) {
      const matches = (await searchResponse.json()) as Array<{
        id: number;
        name: string;
        kind: string;
        is_variant_dimension: boolean;
      }>;
      const exact =
        matches.find(
          (item) =>
            item.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
        ) ?? null;
      if (exact) {
        characteristicId = exact.id;
        kind = exact.kind || kind;
      }
    }
  }

  if (!characteristicId) {
    const created = (await request("/definitions", "POST", {
      name,
      kind: "STRING",
      is_variant_dimension: false,
    })) as { id: number; kind: string };
    characteristicId = created.id;
    kind = created.kind || "STRING";
  }

  try {
    await request(`/nomenclatures/${nomenclatureId}/values`, "POST", {
      characteristic_id: characteristicId,
    });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("уже назначен")) {
      throw error;
    }
  }

  const raw = value(formData, "value");
  let fieldValue: unknown = raw;
  if (kind === "BOOLEAN") fieldValue = raw === "true";
  else if (kind === "INTEGER") fieldValue = raw === "" ? null : Number(raw);
  else if (
    kind === "LIST" ||
    kind === "SINGLE_SELECT" ||
    kind === "MULTI_SELECT" ||
    kind === "COLOR"
  ) {
    fieldValue = raw === "" ? null : Number.isFinite(Number(raw)) ? Number(raw) : raw;
  } else if (raw === "") fieldValue = null;

  if (fieldValue !== null && fieldValue !== "") {
    await request(`/nomenclatures/${nomenclatureId}/values`, "PUT", [
      { characteristic_id: characteristicId, value: fieldValue },
    ]);
  }

  revalidatePath(`/settings/catalogs/nomenclature/${nomenclatureId}`);
  revalidatePath("/settings/catalogs/product-characteristics");
}

export async function removeNomenclatureCharacteristicValue(formData: FormData) {
  const nomenclatureId = value(formData, "nomenclature_id");
  const characteristicId = value(formData, "characteristic_id") || value(formData, "field_definition_id");
  await request(
    `/nomenclatures/${nomenclatureId}/values/${characteristicId}`,
    "DELETE",
  );
  revalidatePath(`/settings/catalogs/nomenclature/${nomenclatureId}`);
}

export async function assignNomenclatureCharacteristic(formData: FormData) {
  await request(`/nomenclatures/${formData.get("nomenclature_id")}`, "POST", {
    characteristic_id: Number(formData.get("characteristic_id")),
  });
  revalidatePath(
    `/settings/catalogs/nomenclature/${formData.get("nomenclature_id")}`,
  );
}

export async function generateNomenclatureVariants(formData: FormData) {
  await request(
    `/nomenclatures/${formData.get("nomenclature_id")}/variants/generate`,
    "POST",
    { article_prefix: String(formData.get("article_prefix")) },
  );
  revalidatePath(
    `/settings/catalogs/nomenclature/${formData.get("nomenclature_id")}`,
  );
}

export async function toggleNomenclatureVariant(formData: FormData) {
  await request(`/variants/${formData.get("variant_id")}`, "PATCH", {
    is_active: formData.get("is_active") !== "true",
  });
  revalidatePath(
    `/settings/catalogs/nomenclature/${formData.get("nomenclature_id")}`,
  );
}

export async function uploadNomenclatureMedia(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Выберите файл изображения");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Размер изображения не должен превышать 10 МБ");
  }
  const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
  const response = await fetch(
    `${mediaBase()}/nomenclatures/${formData.get("nomenclature_id")}/media`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        mime_type: file.type,
        content_base64: bytes,
        alt_text: String(formData.get("alt_text") ?? "") || null,
        sort_order: Number(formData.get("sort_order") ?? 0),
        is_primary: formData.get("is_primary") === "true",
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(data?.detail ?? `Backend вернул ${response.status}`);
  }
  const created = (await response.json()) as NomenclatureMedia;
  revalidatePath(
    `/settings/catalogs/nomenclature/${formData.get("nomenclature_id")}`,
  );
  return created;
}

export async function deleteNomenclatureMedia(formData: FormData) {
  const response = await fetch(
    `${mediaBase()}/nomenclatures/${formData.get("nomenclature_id")}/media/${formData.get("media_id")}`,
    { method: "DELETE", cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Backend вернул ${response.status}`);
  revalidatePath(
    `/settings/catalogs/nomenclature/${formData.get("nomenclature_id")}`,
  );
}

export async function updateNomenclatureMedia(formData: FormData) {
  const response = await fetch(
    `${mediaBase()}/nomenclatures/${formData.get("nomenclature_id")}/media/${formData.get("media_id")}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sort_order: Number(formData.get("sort_order") ?? 0),
        is_primary: formData.get("is_primary") === "true",
        alt_text: String(formData.get("alt_text") ?? "") || null,
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(data?.detail ?? `Backend вернул ${response.status}`);
  }
  revalidatePath(
    `/settings/catalogs/nomenclature/${formData.get("nomenclature_id")}`,
  );
}
