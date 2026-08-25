"use server";

import { revalidatePath } from "next/cache";

import type { OrganizationDraft } from "@/lib/settings/organizations";
import { validateInn, validateKpp, validateOgrn } from "@/lib/sales/client-requisites";

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

function revalidateOrgs(organizationId?: number) {
  revalidatePath("/settings/organizations");
  if (organizationId != null) {
    revalidatePath(`/settings/organizations/${organizationId}`);
  }
}

function payloadFromDraft(draft: OrganizationDraft) {
  return {
    name: draft.name,
    legal_form: draft.legalForm,
    tax_id: draft.taxId,
    ogrn: draft.ogrn,
    kpp: draft.kpp,
    tax_system: draft.taxSystem,
    director: draft.director,
    legal_address: draft.legalAddress,
    is_active: draft.isActive,
  };
}

function validateDraft(draft: OrganizationDraft): string | null {
  if (!draft.name.trim()) return "Укажите наименование";
  return (
    validateInn(draft.taxId) ??
    validateKpp(draft.kpp) ??
    validateOgrn(draft.ogrn)
  );
}

export async function createOrganizationRecord(
  draft: OrganizationDraft,
): Promise<{ ok: true; id: number } | { ok: false; message: string }> {
  const message = validateDraft(draft);
  if (message) return { ok: false, message };
  const response = await fetch(`${apiBaseUrl()}/organizations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloadFromDraft(draft)),
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, message: await readError(response) };
  const body = (await response.json()) as { id: number };
  revalidateOrgs(body.id);
  return { ok: true, id: body.id };
}

export async function saveOrganizationRecord(
  organizationId: number,
  draft: OrganizationDraft,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const message = validateDraft(draft);
  if (message) return { ok: false, message };
  const response = await fetch(`${apiBaseUrl()}/organizations/${organizationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloadFromDraft(draft)),
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, message: await readError(response) };
  revalidateOrgs(organizationId);
  return { ok: true };
}
