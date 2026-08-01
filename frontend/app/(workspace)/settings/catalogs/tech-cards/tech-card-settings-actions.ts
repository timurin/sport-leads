"use server";

import { revalidatePath } from "next/cache";

import {
  validateTechnicalCardSettingsDraft,
  type TechnicalCardSettings,
  type TechnicalCardSettingsDraft,
} from "@/lib/technical-card-settings";

const CATALOG_PATH = "/settings/catalogs/tech-cards";

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
    if (Array.isArray(body.detail) && body.detail.length > 0) {
      const first = body.detail[0] as { msg?: string };
      if (typeof first?.msg === "string" && first.msg.trim()) {
        return first.msg;
      }
    }
  } catch {
    /* ignore */
  }
  return `Ошибка API (${response.status})`;
}

export async function updateTechnicalCardSettings(
  draft: TechnicalCardSettingsDraft,
): Promise<
  | { ok: true; settings: TechnicalCardSettings }
  | { ok: false; message: string }
> {
  const validationError = validateTechnicalCardSettingsDraft(draft);
  if (validationError) {
    return { ok: false, message: validationError };
  }

  const response = await fetch(`${apiBaseUrl()}/technical-card-settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...draft,
      eligible_nomenclature_types: draft.eligible_nomenclature_types,
      numbering_template: draft.numbering_template.trim(),
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }

  const settings = (await response.json()) as TechnicalCardSettings;
  revalidatePath(CATALOG_PATH);
  return { ok: true, settings };
}
