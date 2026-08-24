"use server";

import { revalidatePath } from "next/cache";

import type { ClientBankAccountDraft, ClientRequisitesDraft } from "@/lib/sales/client-requisites";

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

function revalidateClient(clientId: number) {
  revalidatePath(`/sales/clients/${clientId}`);
  revalidatePath("/sales/clients");
}

export async function saveClientRequisites(
  clientId: number,
  draft: ClientRequisitesDraft,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(`${apiBaseUrl()}/clients/${clientId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inn: draft.inn,
      kpp: draft.kpp,
      ogrn: draft.ogrn,
      legal_address: draft.legalAddress,
      actual_address: draft.actualAddress,
    }),
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, message: await readError(response) };
  revalidateClient(clientId);
  return { ok: true };
}

export async function createClientBankAccount(
  clientId: number,
  draft: ClientBankAccountDraft,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(`${apiBaseUrl()}/clients/${clientId}/bank-accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bank_name: draft.bankName,
      bik: draft.bik,
      account_number: draft.accountNumber,
      corr_account: draft.corrAccount || null,
      is_primary: draft.isPrimary,
    }),
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, message: await readError(response) };
  revalidateClient(clientId);
  return { ok: true };
}

export async function deleteClientBankAccount(
  clientId: number,
  accountId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(
    `${apiBaseUrl()}/clients/${clientId}/bank-accounts/${accountId}`,
    { method: "DELETE", cache: "no-store" },
  );
  if (!response.ok && response.status !== 204) {
    return { ok: false, message: await readError(response) };
  }
  revalidateClient(clientId);
  return { ok: true };
}

export async function setPrimaryClientBankAccount(
  clientId: number,
  accountId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(
    `${apiBaseUrl()}/clients/${clientId}/bank-accounts/${accountId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_primary: true }),
      cache: "no-store",
    },
  );
  if (!response.ok) return { ok: false, message: await readError(response) };
  revalidateClient(clientId);
  return { ok: true };
}
