"use server";

import { revalidatePath } from "next/cache";

import type { SupplierDraft } from "@/lib/purchases/suppliers";
import { validateInn, validateKpp } from "@/lib/sales/client-requisites";

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

async function readError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as
    | { detail?: string | Array<{ msg?: string }> }
    | null;
  if (typeof data?.detail === "string") return data.detail;
  if (Array.isArray(data?.detail) && data.detail.length > 0) {
    return (
      data.detail.map((item) => item.msg).filter(Boolean).join("; ") ||
      `Ошибка API (${response.status})`
    );
  }
  return `Ошибка API (${response.status})`;
}

function revalidateSuppliers(supplierId?: number) {
  revalidatePath("/purchases");
  revalidatePath("/purchases/suppliers");
  if (supplierId != null) {
    revalidatePath(`/purchases/suppliers/${supplierId}`);
  }
}

function payloadFromDraft(draft: SupplierDraft) {
  return {
    name: draft.name.trim(),
    code: draft.code.trim() || null,
    inn: draft.inn.trim() || null,
    kpp: draft.kpp.trim() || null,
    phone: draft.phone.trim() || null,
    email: draft.email.trim() || null,
    legal_address: draft.legalAddress.trim() || null,
    notes: draft.notes.trim() || null,
    is_active: draft.isActive,
  };
}

function validateDraft(draft: SupplierDraft): string | null {
  if (!draft.name.trim()) return "Укажите наименование";
  const innError = validateInn(draft.inn);
  if (innError) return innError;
  const kppError = validateKpp(draft.kpp);
  if (kppError) return kppError;
  return null;
}

export async function createSupplierRecord(
  draft: SupplierDraft,
): Promise<{ ok: true; id: number } | { ok: false; message: string }> {
  const validation = validateDraft(draft);
  if (validation) return { ok: false, message: validation };
  try {
    const response = await fetch(`${apiBaseUrl()}/suppliers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFromDraft(draft)),
    });
    if (!response.ok) {
      return { ok: false, message: await readError(response) };
    }
    const body = (await response.json()) as { id: number };
    revalidateSuppliers(body.id);
    return { ok: true, id: body.id };
  } catch {
    return { ok: false, message: "Не удалось создать поставщика." };
  }
}

export async function saveSupplierRecord(
  supplierId: number,
  draft: SupplierDraft,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const validation = validateDraft(draft);
  if (validation) return { ok: false, message: validation };
  try {
    const response = await fetch(`${apiBaseUrl()}/suppliers/${supplierId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFromDraft(draft)),
    });
    if (!response.ok) {
      return { ok: false, message: await readError(response) };
    }
    revalidateSuppliers(supplierId);
    return { ok: true };
  } catch {
    return { ok: false, message: "Не удалось сохранить поставщика." };
  }
}

export async function createSupplierPriceRecord(
  supplierId: number,
  input: { nomenclatureId: number; unitPrice: string; comment: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const price = Number(input.unitPrice.replace(",", "."));
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, message: "Цена должна быть больше 0" };
  }
  if (!input.nomenclatureId) {
    return { ok: false, message: "Выберите номенклатуру" };
  }
  try {
    const response = await fetch(
      `${apiBaseUrl()}/suppliers/${supplierId}/prices`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomenclature_id: input.nomenclatureId,
          unit_price: price.toFixed(2),
          currency: "RUB",
          comment: input.comment.trim() || null,
        }),
      },
    );
    if (!response.ok) {
      return { ok: false, message: await readError(response) };
    }
    revalidateSuppliers(supplierId);
    return { ok: true };
  } catch {
    return { ok: false, message: "Не удалось добавить цену." };
  }
}

export async function deleteSupplierPriceRecord(
  supplierId: number,
  priceId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await fetch(
      `${apiBaseUrl()}/suppliers/${supplierId}/prices/${priceId}`,
      { method: "DELETE" },
    );
    if (!response.ok && response.status !== 204) {
      return { ok: false, message: await readError(response) };
    }
    revalidateSuppliers(supplierId);
    return { ok: true };
  } catch {
    return { ok: false, message: "Не удалось удалить цену." };
  }
}
