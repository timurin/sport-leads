"use server";

import { revalidatePath } from "next/cache";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import type {
  PrintForm,
  PrintFormDraft,
  PrintFormPreview,
  PrintFormVersion,
  PrintFormVersionDraft,
} from "@/lib/print-forms";

const LIST_PATH = "/settings/print-forms";

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
    return "Недостаточно прав для печатных форм";
  }
  if (response.status === 404) return "Печатная форма не найдена";
  return `Ошибка API (${response.status})`;
}

function revalidatePrintForms(printFormId?: number) {
  revalidatePath(LIST_PATH);
  if (printFormId != null) {
    revalidatePath(`${LIST_PATH}/${printFormId}`);
  }
}

export async function loadPrintForms(): Promise<
  { ok: true; items: PrintForm[] } | { ok: false; message: string }
> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/print-forms`, {
    headers: { ...auth },
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  return {
    ok: true,
    items: (await response.json()) as PrintForm[],
  };
}

export async function loadPrintForm(
  printFormId: number,
): Promise<{ ok: true; item: PrintForm } | { ok: false; message: string }> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/print-forms/${printFormId}`, {
    headers: { ...auth },
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  return {
    ok: true,
    item: (await response.json()) as PrintForm,
  };
}

export async function createPrintForm(
  draft: PrintFormDraft,
): Promise<{ ok: true; item: PrintForm } | { ok: false; message: string }> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/print-forms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({
      code: draft.code.trim(),
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      binding_type: draft.binding_type,
      binding_key: draft.binding_key.trim(),
      output_format: draft.output_format,
      versioning_mode: "single_active",
      status: "draft",
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const item = (await response.json()) as PrintForm;
  revalidatePrintForms(item.id);
  return { ok: true, item };
}

export async function updatePrintForm(
  printFormId: number,
  draft: PrintFormDraft,
): Promise<{ ok: true; item: PrintForm } | { ok: false; message: string }> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/print-forms/${printFormId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      binding_type: draft.binding_type,
      binding_key: draft.binding_key.trim(),
      output_format: draft.output_format,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const item = (await response.json()) as PrintForm;
  revalidatePrintForms(printFormId);
  return { ok: true, item };
}

export async function activatePrintForm(
  printFormId: number,
): Promise<{ ok: true; item: PrintForm } | { ok: false; message: string }> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/print-forms/${printFormId}/activate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({}),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const item = (await response.json()) as PrintForm;
  revalidatePrintForms(printFormId);
  return { ok: true, item };
}

export async function archivePrintForm(
  printFormId: number,
): Promise<{ ok: true; item: PrintForm } | { ok: false; message: string }> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/print-forms/${printFormId}/archive`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({}),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const item = (await response.json()) as PrintForm;
  revalidatePrintForms(printFormId);
  return { ok: true, item };
}

export async function createPrintFormVersion(
  printFormId: number,
  draft: PrintFormVersionDraft,
): Promise<
  { ok: true; version: PrintFormVersion } | { ok: false; message: string }
> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/print-forms/${printFormId}/versions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({
        template_label: draft.template_label.trim(),
        storage_kind: draft.storage_kind,
        template_source: draft.template_source,
        status: "draft",
        is_current: false,
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const version = (await response.json()) as PrintFormVersion;
  revalidatePrintForms(printFormId);
  return { ok: true, version };
}

export async function publishPrintFormVersion(
  printFormId: number,
  versionId: number,
): Promise<
  { ok: true; version: PrintFormVersion } | { ok: false; message: string }
> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/print-forms/${printFormId}/versions/${versionId}/publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({ is_current: true }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const version = (await response.json()) as PrintFormVersion;
  revalidatePrintForms(printFormId);
  return { ok: true, version };
}

export async function previewPrintForm(
  printFormId: number,
  versionId: number | null,
  payload: Record<string, unknown>,
): Promise<
  { ok: true; preview: PrintFormPreview } | { ok: false; message: string }
> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/print-forms/${printFormId}/preview`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({
        version_id: versionId ?? undefined,
        payload,
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  return {
    ok: true,
    preview: (await response.json()) as PrintFormPreview,
  };
}
