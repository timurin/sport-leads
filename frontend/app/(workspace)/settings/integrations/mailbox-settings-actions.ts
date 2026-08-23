"use server";

import { revalidatePath } from "next/cache";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import {
  mailboxSettingsUpdatePayload,
  type MailboxSettings,
  type MailboxSettingsDraft,
} from "@/lib/mailbox-settings";

export type MailboxSettingsLoadResult =
  | { ok: true; settings: MailboxSettings }
  | { ok: false; status: number; message: string };

export type MailboxSettingsSaveResult =
  | { ok: true; settings: MailboxSettings }
  | { ok: false; message: string };

const MAILBOX_PATH = "/settings/integrations";

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
    return "Недостаточно прав для изменения почтового ящика";
  }
  return `Ошибка API (${response.status})`;
}

export async function loadMailboxSettings(): Promise<MailboxSettingsLoadResult> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/mailbox-settings`, {
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
    settings: (await response.json()) as MailboxSettings,
  };
}

export async function updateMailboxSettings(
  draft: MailboxSettingsDraft,
): Promise<MailboxSettingsSaveResult> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/mailbox-settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify(mailboxSettingsUpdatePayload(draft)),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const settings = (await response.json()) as MailboxSettings;
  revalidatePath(MAILBOX_PATH);
  return { ok: true, settings };
}
