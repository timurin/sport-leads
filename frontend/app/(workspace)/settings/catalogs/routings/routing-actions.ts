"use server";

import { revalidatePath } from "next/cache";

import {
  validateShopRoutingCreateDraft,
  validateShopRoutingStages,
  type ShopRoutingCreateDraft,
  type ShopRoutingStageDraft,
  type ShopRoutingTemplate,
} from "@/lib/shop-routings";

export type ShopRoutingActionResult =
  | { ok: true; routing: ShopRoutingTemplate }
  | { ok: false; message: string };

const LIST_PATH = "/settings/catalogs/routings";

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

function revalidateRouting(templateId?: number) {
  revalidatePath(LIST_PATH);
  if (templateId != null) {
    revalidatePath(`${LIST_PATH}/${templateId}`);
  }
}

function stagesPayload(stages: ShopRoutingStageDraft[]) {
  return stages.map((stage) => ({
    stage_order: stage.stage_order,
    stage_label: stage.stage_label.trim(),
    tech_operation_id: stage.tech_operation_id,
    work_center_id: stage.work_center_id,
    is_quality_checkpoint: stage.is_quality_checkpoint,
  }));
}

export async function createShopRouting(
  draft: ShopRoutingCreateDraft,
): Promise<ShopRoutingActionResult> {
  const validationError = validateShopRoutingCreateDraft(draft);
  if (validationError) {
    return { ok: false, message: validationError };
  }

  const response = await fetch(`${apiBaseUrl()}/shop-routings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: draft.name.trim(),
      code: draft.code.trim() || null,
      is_active: draft.is_active,
      stages: stagesPayload(draft.stages),
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const routing = (await response.json()) as ShopRoutingTemplate;
  revalidateRouting(routing.id);
  return { ok: true, routing };
}

export type ShopRoutingUpdatePayload = {
  name: string;
  code: string;
  is_active: boolean;
  stages: ShopRoutingStageDraft[];
};

export async function updateShopRouting(
  templateId: number,
  payload: ShopRoutingUpdatePayload,
): Promise<ShopRoutingActionResult> {
  if (!payload.name.trim()) {
    return { ok: false, message: "Укажите наименование маршрута" };
  }
  const stagesError = validateShopRoutingStages(payload.stages);
  if (stagesError) {
    return { ok: false, message: stagesError };
  }

  const response = await fetch(`${apiBaseUrl()}/shop-routings/${templateId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: payload.name.trim(),
      code: payload.code.trim() || null,
      is_active: payload.is_active,
      stages: stagesPayload(payload.stages),
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const routing = (await response.json()) as ShopRoutingTemplate;
  revalidateRouting(templateId);
  return { ok: true, routing };
}

export async function deleteShopRouting(
  templateId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(`${apiBaseUrl()}/shop-routings/${templateId}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!response.ok && response.status !== 204) {
    return { ok: false, message: await readError(response) };
  }
  revalidateRouting(templateId);
  return { ok: true };
}
