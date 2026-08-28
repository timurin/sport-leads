"use server";

import { revalidatePath } from "next/cache";

import type { ClientDuplicateCandidate } from "@/lib/sales/client-segments";

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

export async function findClientDuplicates(params: {
  name?: string;
  phone?: string;
  inn?: string;
  excludeClientId?: number;
}): Promise<
  | { ok: true; candidates: ClientDuplicateCandidate[] }
  | { ok: false; message: string }
> {
  const query = new URLSearchParams();
  if (params.name?.trim()) query.set("name", params.name.trim());
  const phone = params.phone?.trim();
  if (phone && phone !== "—") query.set("phone", phone);
  if (params.inn?.trim()) query.set("inn", params.inn.trim());
  if (params.excludeClientId != null) {
    query.set("exclude_client_id", String(params.excludeClientId));
  }
  if ([...query.keys()].every((key) => key === "exclude_client_id")) {
    return { ok: true, candidates: [] };
  }
  const response = await fetch(
    `${apiBaseUrl()}/clients/duplicate-candidates?${query.toString()}`,
    { cache: "no-store" },
  );
  if (!response.ok) return { ok: false, message: await readError(response) };
  return {
    ok: true,
    candidates: (await response.json()) as ClientDuplicateCandidate[],
  };
}

export async function saveClientSegments(
  clientId: number,
  tags: string[],
): Promise<{ ok: true; tags: string[] } | { ok: false; message: string }> {
  const response = await fetch(`${apiBaseUrl()}/clients/${clientId}/segments`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tags }),
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, message: await readError(response) };
  revalidatePath(`/sales/clients/${clientId}`);
  revalidatePath("/sales/clients");
  return { ok: true, tags: (await response.json()) as string[] };
}

export async function createClientRecord(payload: {
  contactName: string;
  companyName: string;
  phone: string;
  inn: string;
  tags: string[];
}): Promise<{ ok: true; id: number; label: string } | { ok: false; message: string }> {
  const response = await fetch(`${apiBaseUrl()}/clients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contact_name: payload.contactName,
      company_name: payload.companyName || null,
      phone: payload.phone || null,
      inn: payload.inn || null,
    }),
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, message: await readError(response) };
  const created = (await response.json()) as {
    id: number;
    company_name: string | null;
    contact_name: string;
  };
  if (payload.tags.length > 0) {
    const segments = await saveClientSegments(created.id, payload.tags);
    if (!segments.ok) return segments;
  }
  revalidatePath("/sales/clients");
  const label = (created.company_name ?? "").trim() || created.contact_name;
  return { ok: true, id: created.id, label };
}
