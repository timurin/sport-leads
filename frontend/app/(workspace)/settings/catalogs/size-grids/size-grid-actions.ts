"use server";

import { revalidatePath } from "next/cache";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import {
  sizeGridRowDraftToPayload,
  validateSizeGridDraft,
  validateSizeGridRowDraft,
  type SizeGrid,
  type SizeGridDraft,
  type SizeGridRowDraft,
} from "@/lib/size-grids";

export type SizeGridActionResult =
  | { ok: true; grid: SizeGrid }
  | { ok: false; message: string };

const LIST_PATH = "/settings/catalogs/size-grids";

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

function revalidate(gridId?: number) {
  revalidatePath(LIST_PATH);
  if (gridId != null) {
    revalidatePath(`${LIST_PATH}/${gridId}`);
  }
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
  if (response.status === 401) return "Требуется вход";
  if (response.status === 403) return "Недостаточно прав для изменения сеток";
  return `Ошибка API (${response.status})`;
}

export async function createSizeGrid(
  draft: SizeGridDraft,
): Promise<SizeGridActionResult> {
  const validationError = validateSizeGridDraft(draft);
  if (validationError) return { ok: false, message: validationError };

  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/size-grids`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({
      name: draft.name.trim(),
      size_type: draft.size_type,
      source_note: draft.source_note.trim() || null,
      rows: [],
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const grid = (await response.json()) as SizeGrid;
  revalidate(grid.id);
  return { ok: true, grid };
}

export async function updateSizeGrid(
  gridId: number,
  draft: SizeGridDraft,
): Promise<SizeGridActionResult> {
  const validationError = validateSizeGridDraft(draft);
  if (validationError) return { ok: false, message: validationError };

  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/size-grids/${gridId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({
      name: draft.name.trim(),
      source_note: draft.source_note.trim() || null,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const grid = (await response.json()) as SizeGrid;
  revalidate(grid.id);
  return { ok: true, grid };
}

export async function deleteSizeGrid(
  gridId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/size-grids/${gridId}`, {
    method: "DELETE",
    headers: { ...auth },
    cache: "no-store",
  });
  if (!response.ok && response.status !== 204) {
    return { ok: false, message: await readError(response) };
  }
  revalidate();
  return { ok: true };
}

export async function createSizeGridRow(
  gridId: number,
  draft: SizeGridRowDraft,
): Promise<SizeGridActionResult> {
  const validationError = validateSizeGridRowDraft(draft);
  if (validationError) return { ok: false, message: validationError };

  const auth = await sessionAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/size-grids/${gridId}/rows`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify(sizeGridRowDraftToPayload(draft)),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const grid = (await response.json()) as SizeGrid;
  revalidate(grid.id);
  return { ok: true, grid };
}

export async function updateSizeGridRow(
  gridId: number,
  rowId: number,
  draft: SizeGridRowDraft,
): Promise<SizeGridActionResult> {
  const validationError = validateSizeGridRowDraft(draft);
  if (validationError) return { ok: false, message: validationError };

  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/size-grids/${gridId}/rows/${rowId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify(sizeGridRowDraftToPayload(draft)),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const grid = (await response.json()) as SizeGrid;
  revalidate(grid.id);
  return { ok: true, grid };
}

export async function deleteSizeGridRow(
  gridId: number,
  rowId: number,
): Promise<SizeGridActionResult> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/size-grids/${gridId}/rows/${rowId}`,
    {
      method: "DELETE",
      headers: { ...auth },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }
  const grid = (await response.json()) as SizeGrid;
  revalidate(grid.id);
  return { ok: true, grid };
}
