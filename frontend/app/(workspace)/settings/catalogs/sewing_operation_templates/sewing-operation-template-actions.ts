"use server";

import { revalidatePath } from "next/cache";

import {
  validateSewingOperationTemplateName,
  type SewingOperationTemplate,
} from "@/lib/sewing-operation-templates";

export type SewingTemplateActionResult =
  | { ok: true; template: SewingOperationTemplate }
  | { ok: false; message: string };

const CATALOG_PATH = "/settings/catalogs/sewing_operations";

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
  return `Ошибка API (${response.status})`;
}

export async function createSewingOperationTemplate(input: {
  name: string;
  sewing_operation_ids: number[];
}): Promise<SewingTemplateActionResult> {
  const validationError = validateSewingOperationTemplateName(input.name);
  if (validationError) return { ok: false, message: validationError };
  const response = await fetch(`${apiBaseUrl()}/sewing-operation-templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name.trim(),
      sewing_operation_ids: input.sewing_operation_ids,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const template = (await response.json()) as SewingOperationTemplate;
  revalidatePath(CATALOG_PATH);
  return { ok: true, template };
}

export async function updateSewingOperationTemplate(
  templateId: number,
  input: { name?: string; sewing_operation_ids?: number[] },
): Promise<SewingTemplateActionResult> {
  if (input.name != null) {
    const validationError = validateSewingOperationTemplateName(input.name);
    if (validationError) return { ok: false, message: validationError };
  }
  const body: Record<string, unknown> = {};
  if (input.name != null) body.name = input.name.trim();
  if (input.sewing_operation_ids != null) {
    body.sewing_operation_ids = input.sewing_operation_ids;
  }
  const response = await fetch(
    `${apiBaseUrl()}/sewing-operation-templates/${templateId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const template = (await response.json()) as SewingOperationTemplate;
  revalidatePath(CATALOG_PATH);
  return { ok: true, template };
}

export async function deleteSewingOperationTemplate(
  templateId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(
    `${apiBaseUrl()}/sewing-operation-templates/${templateId}`,
    { method: "DELETE", cache: "no-store" },
  );
  if (!response.ok && response.status !== 204) {
    return { ok: false, message: await readError(response) };
  }
  revalidatePath(CATALOG_PATH);
  return { ok: true };
}
