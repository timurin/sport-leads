"use server";

import { revalidatePath } from "next/cache";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import type {
  PlatformCity,
  PlatformCityDraft,
  PlatformDirectoryRegistryItem,
} from "@/lib/platform-directories";

const HUB_PATH = "/settings/platform-directories";
const CITIES_PATH = "/settings/platform-directories/cities";

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string | unknown };
    if (typeof body.detail === "string" && body.detail.trim()) {
      return body.detail;
    }
  } catch {
    /* ignore */
  }
  if (response.status === 401) return "Требуется вход";
  if (response.status === 403) {
    return "Недостаточно прав для справочников платформы";
  }
  return `Ошибка API (${response.status})`;
}

function revalidateCities() {
  revalidatePath(HUB_PATH);
  revalidatePath(CITIES_PATH);
  revalidatePath("/settings/catalogs/cities");
}

export async function loadPlatformDirectoryRegistry(): Promise<
  | { ok: true; items: PlatformDirectoryRegistryItem[] }
  | { ok: false; message: string }
> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/platform-directories`, {
    headers: { ...auth },
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  return {
    ok: true,
    items: (await response.json()) as PlatformDirectoryRegistryItem[],
  };
}

export async function loadPlatformCities(options?: {
  q?: string;
  is_active?: boolean;
}): Promise<
  { ok: true; cities: PlatformCity[] } | { ok: false; message: string }
> {
  const auth = await sessionAuthHeaders();
  const query = new URLSearchParams();
  if (options?.q) query.set("q", options.q);
  if (options?.is_active != null) {
    query.set("is_active", String(options.is_active));
  }
  const suffix = query.toString() ? `?${query}` : "";
  const response = await fetch(
    `${apiBaseUrl()}/platform-directories/cities${suffix}`,
    { headers: { ...auth }, cache: "no-store" },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  return {
    ok: true,
    cities: (await response.json()) as PlatformCity[],
  };
}

export async function loadPlatformCity(
  cityId: number,
): Promise<{ ok: true; city: PlatformCity } | { ok: false; message: string }> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/platform-directories/cities/${cityId}`,
    { headers: { ...auth }, cache: "no-store" },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  return { ok: true, city: (await response.json()) as PlatformCity };
}

export async function createPlatformCity(
  draft: PlatformCityDraft,
): Promise<{ ok: true; city: PlatformCity } | { ok: false; message: string }> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/platform-directories/cities`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({
      name: draft.name.trim(),
      region: draft.region.trim() || null,
      is_active: draft.is_active,
      sort_order: draft.sort_order,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const city = (await response.json()) as PlatformCity;
  revalidateCities();
  return { ok: true, city };
}

export async function updatePlatformCity(
  cityId: number,
  draft: PlatformCityDraft,
): Promise<{ ok: true; city: PlatformCity } | { ok: false; message: string }> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/platform-directories/cities/${cityId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({
        name: draft.name.trim(),
        region: draft.region.trim() || null,
        is_active: draft.is_active,
        sort_order: draft.sort_order,
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const city = (await response.json()) as PlatformCity;
  revalidateCities();
  revalidatePath(`${CITIES_PATH}/${cityId}`);
  return { ok: true, city };
}

export async function deletePlatformCity(
  cityId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/platform-directories/cities/${cityId}`,
    { method: "DELETE", headers: { ...auth }, cache: "no-store" },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  revalidateCities();
  return { ok: true };
}
