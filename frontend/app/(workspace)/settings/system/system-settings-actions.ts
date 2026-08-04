"use server";

import { revalidatePath } from "next/cache";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import type {
  PlatformSystemSettings,
  PlatformSystemSettingsDraft,
} from "@/lib/platform-system-settings";

export type PlatformSystemSettingsLoadResult =
  | { ok: true; settings: PlatformSystemSettings }
  | { ok: false; status: number; message: string };

export type PlatformSystemSettingsSaveResult =
  | { ok: true; settings: PlatformSystemSettings }
  | { ok: false; message: string };

const SYSTEM_PATH = "/settings/system";

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
    return "Недостаточно прав для изменения системных настроек";
  }
  return `Ошибка API (${response.status})`;
}

function revalidateBrandSurfaces() {
  revalidatePath(SYSTEM_PATH);
  revalidatePath("/", "layout");
}

export async function loadPlatformSystemSettings(): Promise<PlatformSystemSettingsLoadResult> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/platform-system-settings`, {
    headers: { ...auth },
    cache: "no-store",
  });
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: await readError(response),
    };
  }
  return {
    ok: true,
    settings: (await response.json()) as PlatformSystemSettings,
  };
}

export async function updatePlatformSystemSettings(
  draft: PlatformSystemSettingsDraft,
): Promise<PlatformSystemSettingsSaveResult> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/platform-system-settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({
      organization_display_name: draft.organization_display_name.trim(),
      default_timezone: draft.default_timezone.trim(),
      support_email: draft.support_email.trim() || null,
      ui_locale: draft.ui_locale.trim(),
      notes: draft.notes.trim() || null,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const settings = (await response.json()) as PlatformSystemSettings;
  revalidateBrandSurfaces();
  return { ok: true, settings };
}

export async function uploadPlatformSystemLogo(
  formData: FormData,
): Promise<PlatformSystemSettingsSaveResult> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/platform-system-settings/logo`, {
    method: "POST",
    headers: { ...auth },
    body: formData,
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const settings = (await response.json()) as PlatformSystemSettings;
  revalidateBrandSurfaces();
  return { ok: true, settings };
}

export async function deletePlatformSystemLogo(): Promise<PlatformSystemSettingsSaveResult> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/platform-system-settings/logo`, {
    method: "DELETE",
    headers: { ...auth },
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const settings = (await response.json()) as PlatformSystemSettings;
  revalidateBrandSurfaces();
  return { ok: true, settings };
}
