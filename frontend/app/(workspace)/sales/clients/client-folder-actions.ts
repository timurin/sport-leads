"use server";

import { revalidatePath } from "next/cache";

import type { ClientFolderView } from "@/lib/sales/client-folders";
import { fromApiClientFolder, type ApiClientFolder } from "@/lib/sales/client-folders";

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

function revalidateClients() {
  revalidatePath("/sales/clients");
}

export type ClientFolderActionResult =
  | { ok: true; folder: ClientFolderView }
  | { ok: false; message: string };

export async function createClientFolder(input: {
  name: string;
  parent_id: number | null;
}): Promise<ClientFolderActionResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Укажите название папки" };
  const response = await fetch(`${apiBaseUrl()}/client-folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, parent_id: input.parent_id }),
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, message: await readError(response) };
  revalidateClients();
  return { ok: true, folder: fromApiClientFolder((await response.json()) as ApiClientFolder) };
}

export async function updateClientFolder(
  folderId: number,
  input: { name?: string; parent_id?: number | null },
): Promise<ClientFolderActionResult> {
  const body: Record<string, unknown> = {};
  if (input.name != null) body.name = input.name.trim();
  if ("parent_id" in input) body.parent_id = input.parent_id ?? null;
  const response = await fetch(`${apiBaseUrl()}/client-folders/${folderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, message: await readError(response) };
  revalidateClients();
  return { ok: true, folder: fromApiClientFolder((await response.json()) as ApiClientFolder) };
}

export async function deleteClientFolder(
  folderId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(`${apiBaseUrl()}/client-folders/${folderId}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!response.ok && response.status !== 204) {
    return { ok: false, message: await readError(response) };
  }
  revalidateClients();
  return { ok: true };
}

export async function moveClientFolderSibling(
  folderId: number,
  direction: "up" | "down",
): Promise<ClientFolderActionResult> {
  const response = await fetch(
    `${apiBaseUrl()}/client-folders/${folderId}/move-sibling`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
      cache: "no-store",
    },
  );
  if (!response.ok) return { ok: false, message: await readError(response) };
  revalidateClients();
  return { ok: true, folder: fromApiClientFolder((await response.json()) as ApiClientFolder) };
}

export async function moveClientToFolder(
  clientId: number,
  folderId: number | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(`${apiBaseUrl()}/clients/${clientId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder_id: folderId }),
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, message: await readError(response) };
  revalidateClients();
  return { ok: true };
}
