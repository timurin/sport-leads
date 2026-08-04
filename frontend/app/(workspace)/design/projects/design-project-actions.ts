"use server";

import { revalidatePath } from "next/cache";

import {
  createDesignProjectApi,
  createDesignVersionApi,
  createDesignVersionAssetApi,
  createDesignVersionCommentApi,
  deleteDesignVersionAssetApi,
  deleteDesignVersionCommentApi,
  fetchDesignVersionAssets,
  fetchDesignVersionComments,
  setDesignVersionAssetPrimaryApi,
  setDesignVersionCurrentApi,
  updateDesignProjectApi,
  type DesignProjectDetail,
  type DesignVersion,
  type DesignVersionAsset,
  type DesignVersionComment,
} from "@/lib/design/design-projects";

export type DesignProjectActionResult =
  | { ok: true; project: DesignProjectDetail }
  | { ok: false; message: string };

export type DesignVersionActionResult =
  | { ok: true; version: DesignVersion }
  | { ok: false; message: string };

export type DesignAssetActionResult =
  | { ok: true; asset: DesignVersionAsset }
  | { ok: false; message: string };

export type DesignCommentActionResult =
  | { ok: true; comment: DesignVersionComment }
  | { ok: false; message: string };

export type DesignAssetsListResult =
  | { ok: true; assets: DesignVersionAsset[] }
  | { ok: false; message: string };

export type DesignCommentsListResult =
  | { ok: true; comments: DesignVersionComment[] }
  | { ok: false; message: string };

function revalidateDesignProjectPaths(projectId?: number) {
  revalidatePath("/design/projects");
  if (projectId != null) {
    revalidatePath(`/design/projects/${projectId}`);
  }
}

export async function createDesignProjectAction(input: {
  sales_order_id: number;
  title?: string | null;
  notes?: string | null;
}): Promise<DesignProjectActionResult> {
  if (!Number.isSafeInteger(input.sales_order_id) || input.sales_order_id <= 0) {
    return { ok: false, message: "Укажите корректный ID заказа покупателя" };
  }
  try {
    const project = await createDesignProjectApi({
      sales_order_id: input.sales_order_id,
      title: input.title?.trim() || null,
      notes: input.notes?.trim() || null,
    });
    revalidateDesignProjectPaths(project.id);
    return { ok: true, project };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Ошибка создания",
    };
  }
}

export async function updateDesignProjectAction(
  projectId: number,
  input: { title?: string | null; notes?: string | null; status?: string | null },
): Promise<DesignProjectActionResult> {
  if (!Number.isSafeInteger(projectId) || projectId <= 0) {
    return { ok: false, message: "Некорректный ID дизайн-проекта" };
  }
  try {
    const project = await updateDesignProjectApi(projectId, input);
    revalidateDesignProjectPaths(projectId);
    return { ok: true, project };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Ошибка обновления",
    };
  }
}

export async function createDesignVersionAction(
  projectId: number,
  input: {
    notes?: string | null;
    make_current?: boolean;
  } = {},
): Promise<DesignVersionActionResult> {
  if (!Number.isSafeInteger(projectId) || projectId <= 0) {
    return { ok: false, message: "Некорректный ID дизайн-проекта" };
  }
  try {
    const version = await createDesignVersionApi(projectId, {
      notes: input.notes?.trim() || null,
      make_current: input.make_current === true,
    });
    revalidateDesignProjectPaths(projectId);
    return { ok: true, version };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Ошибка создания версии",
    };
  }
}

export async function setDesignVersionCurrentAction(
  projectId: number,
  versionId: number,
): Promise<DesignVersionActionResult> {
  if (!Number.isSafeInteger(versionId) || versionId <= 0) {
    return { ok: false, message: "Некорректный ID версии" };
  }
  try {
    const version = await setDesignVersionCurrentApi(projectId, versionId);
    revalidateDesignProjectPaths(projectId);
    return { ok: true, version };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Ошибка назначения current",
    };
  }
}

export async function listDesignVersionAssetsAction(
  projectId: number,
  versionId: number,
): Promise<DesignAssetsListResult> {
  try {
    const assets = await fetchDesignVersionAssets(projectId, versionId);
    return { ok: true, assets };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Ошибка загрузки активов",
    };
  }
}

export async function createDesignVersionAssetAction(
  projectId: number,
  versionId: number,
  input: {
    filename: string;
    mime_type: string;
    content_base64: string;
    kind?: string;
    is_primary?: boolean;
  },
): Promise<DesignAssetActionResult> {
  try {
    const asset = await createDesignVersionAssetApi(projectId, versionId, input);
    revalidateDesignProjectPaths(projectId);
    return { ok: true, asset };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Ошибка загрузки файла",
    };
  }
}

export async function setDesignVersionAssetPrimaryAction(
  projectId: number,
  versionId: number,
  assetId: number,
): Promise<DesignAssetActionResult> {
  try {
    const asset = await setDesignVersionAssetPrimaryApi(projectId, versionId, assetId);
    revalidateDesignProjectPaths(projectId);
    return { ok: true, asset };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Ошибка primary",
    };
  }
}

export async function deleteDesignVersionAssetAction(
  projectId: number,
  versionId: number,
  assetId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await deleteDesignVersionAssetApi(projectId, versionId, assetId);
    revalidateDesignProjectPaths(projectId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Ошибка удаления файла",
    };
  }
}

export async function listDesignVersionCommentsAction(
  projectId: number,
  versionId: number,
): Promise<DesignCommentsListResult> {
  try {
    const comments = await fetchDesignVersionComments(projectId, versionId);
    return { ok: true, comments };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Ошибка загрузки комментариев",
    };
  }
}

export async function createDesignVersionCommentAction(
  projectId: number,
  versionId: number,
  input: { body: string; author_name?: string | null },
): Promise<DesignCommentActionResult> {
  const body = input.body.trim();
  if (!body) return { ok: false, message: "Введите текст комментария" };
  try {
    const comment = await createDesignVersionCommentApi(projectId, versionId, {
      body,
      author_name: input.author_name?.trim() || null,
    });
    revalidateDesignProjectPaths(projectId);
    return { ok: true, comment };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Ошибка комментария",
    };
  }
}

export async function deleteDesignVersionCommentAction(
  projectId: number,
  versionId: number,
  commentId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await deleteDesignVersionCommentApi(projectId, versionId, commentId);
    revalidateDesignProjectPaths(projectId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Ошибка удаления комментария",
    };
  }
}
