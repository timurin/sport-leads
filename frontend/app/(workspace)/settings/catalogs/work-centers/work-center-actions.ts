"use server";

import { revalidatePath } from "next/cache";

import {
  validateWorkCenterDraft,
  type WorkCenter,
  type WorkCenterDraft,
} from "@/lib/shop-routings";

export type WorkCenterActionResult =
  | { ok: true; workCenter: WorkCenter }
  | { ok: false; message: string };

const CATALOG_PATH = "/settings/catalogs/work-centers";
const ROUTINGS_PATH = "/settings/catalogs/routings";

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

function payloadFromDraft(draft: WorkCenterDraft) {
  return {
    name: draft.name.trim(),
    code: draft.code.trim(),
    production_stage_id: draft.production_stage_id,
    is_active: draft.is_active,
  };
}

function revalidate() {
  revalidatePath(CATALOG_PATH);
  revalidatePath(ROUTINGS_PATH);
}

export async function createWorkCenter(
  draft: WorkCenterDraft,
): Promise<WorkCenterActionResult> {
  const validationError = validateWorkCenterDraft(draft);
  if (validationError) {
    return { ok: false, message: validationError };
  }

  const response = await fetch(`${apiBaseUrl()}/work-centers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloadFromDraft(draft)),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const workCenter = (await response.json()) as WorkCenter;
  revalidate();
  return { ok: true, workCenter };
}

export async function updateWorkCenter(
  workCenterId: number,
  draft: WorkCenterDraft,
): Promise<WorkCenterActionResult> {
  const validationError = validateWorkCenterDraft(draft);
  if (validationError) {
    return { ok: false, message: validationError };
  }

  const response = await fetch(`${apiBaseUrl()}/work-centers/${workCenterId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloadFromDraft(draft)),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const workCenter = (await response.json()) as WorkCenter;
  revalidate();
  return { ok: true, workCenter };
}

export async function deleteWorkCenter(
  workCenterId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(`${apiBaseUrl()}/work-centers/${workCenterId}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!response.ok && response.status !== 204) {
    return { ok: false, message: await readError(response) };
  }
  revalidate();
  return { ok: true };
}
