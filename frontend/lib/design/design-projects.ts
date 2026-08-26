import { sameOriginApiMediaUrl } from "../api-media.ts";
import type { StatusBadgeTone } from "@/components/ui/status-badge";

/** Design projects / versions API client (ADR-021 / 10.1.1.4). */

export type DesignVersion = {
  id: number;
  design_project_id: number;
  version_no: number;
  label: string;
  status: string;
  notes: string | null;
  sales_order_item_id: number | null;
  technical_card_id: number | null;
  created_at: string;
  updated_at: string;
};

export type DesignProjectListItem = {
  id: number;
  sales_order_id: number;
  sales_order_number: string | null;
  number: string;
  project_seq: number;
  status: string;
  title: string | null;
  notes: string | null;
  version_count: number;
  current_version_no: number | null;
  created_at: string;
  updated_at: string;
};

export type DesignProjectDetail = {
  id: number;
  sales_order_id: number;
  sales_order_number: string | null;
  number: string;
  project_seq: number;
  status: string;
  title: string | null;
  notes: string | null;
  versions: DesignVersion[];
  created_at: string;
  updated_at: string;
};

export type DesignProjectsListParams = {
  sales_order_id?: number;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

function apiBaseUrl(): string {
  return (
    process.env.SPORT_LEADS_API_URL ??
    process.env.NEXT_PUBLIC_SPORT_LEADS_API_URL ??
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string | unknown };
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
    if (Array.isArray(body.detail) && body.detail[0]) {
      const first = body.detail[0] as { msg?: string };
      if (typeof first.msg === "string" && first.msg.trim()) return first.msg;
    }
  } catch {
    /* ignore */
  }
  return `${fallback} (${response.status})`;
}

export function designProjectStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Черновик";
    case "in_progress":
      return "В работе";
    case "ready":
      return "Готов";
    case "archived":
      return "В архиве";
    default:
      return status;
  }
}

export function designVersionStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Черновик";
    case "current":
      return "Текущая";
    case "superseded":
      return "Заменена";
    default:
      return status;
  }
}

export function designProjectStatusTone(status: string): StatusBadgeTone {
  switch (status) {
    case "draft":
      return "neutral";
    case "in_progress":
      return "primary";
    case "ready":
      return "success";
    case "archived":
      return "warning";
    default:
      return "neutral";
  }
}

export function designVersionStatusTone(status: string): StatusBadgeTone {
  switch (status) {
    case "draft":
      return "neutral";
    case "current":
      return "success";
    case "superseded":
      return "warning";
    default:
      return "neutral";
  }
}

export function filterDesignProjectsClient(
  rows: DesignProjectListItem[],
  query: string,
): DesignProjectListItem[] {
  const needle = query.trim().toLocaleLowerCase("ru");
  if (!needle) return rows;
  return rows.filter(
    (row) =>
      row.number.toLocaleLowerCase("ru").includes(needle) ||
      (row.sales_order_number ?? "").toLocaleLowerCase("ru").includes(needle) ||
      (row.title ?? "").toLocaleLowerCase("ru").includes(needle) ||
      String(row.sales_order_id).includes(needle),
  );
}

function buildListQuery(params: DesignProjectsListParams): string {
  const query = new URLSearchParams();
  if (params.sales_order_id != null) {
    query.set("sales_order_id", String(params.sales_order_id));
  }
  if (params.status?.trim()) query.set("status", params.status.trim());
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export async function fetchDesignProjects(
  params: DesignProjectsListParams = {},
): Promise<DesignProjectListItem[]> {
  const response = await fetch(
    `${apiBaseUrl()}/design-projects${buildListQuery(params)}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Не удалось загрузить дизайн-проекты"));
  }
  return (await response.json()) as DesignProjectListItem[];
}

export async function fetchDesignProject(
  projectId: number | string,
): Promise<DesignProjectDetail> {
  const response = await fetch(`${apiBaseUrl()}/design-projects/${projectId}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Не удалось загрузить дизайн-проект"));
  }
  return (await response.json()) as DesignProjectDetail;
}

export async function createDesignProjectApi(payload: {
  sales_order_id: number;
  title?: string | null;
  notes?: string | null;
}): Promise<DesignProjectDetail> {
  const response = await fetch(`${apiBaseUrl()}/design-projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Не удалось создать дизайн-проект"));
  }
  return (await response.json()) as DesignProjectDetail;
}

export async function updateDesignProjectApi(
  projectId: number | string,
  payload: { title?: string | null; notes?: string | null; status?: string | null },
): Promise<DesignProjectDetail> {
  const response = await fetch(`${apiBaseUrl()}/design-projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Не удалось обновить дизайн-проект"));
  }
  return (await response.json()) as DesignProjectDetail;
}

export async function createDesignVersionApi(
  projectId: number | string,
  payload: {
    notes?: string | null;
    sales_order_item_id?: number | null;
    technical_card_id?: number | null;
    make_current?: boolean;
  } = {},
): Promise<DesignVersion> {
  const response = await fetch(`${apiBaseUrl()}/design-projects/${projectId}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Не удалось создать версию дизайна"));
  }
  return (await response.json()) as DesignVersion;
}

export async function setDesignVersionCurrentApi(
  projectId: number | string,
  versionId: number | string,
): Promise<DesignVersion> {
  const response = await fetch(
    `${apiBaseUrl()}/design-projects/${projectId}/versions/${versionId}/set-current`,
    {
      method: "POST",
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Не удалось назначить текущую версию"));
  }
  return (await response.json()) as DesignVersion;
}

export type DesignVersionAsset = {
  id: number;
  design_version_id: number;
  kind: string;
  filename: string;
  mime_type: string;
  file_size: number;
  sort_order: number;
  is_primary: boolean;
  content_url: string;
  created_at: string;
  updated_at: string;
};

export type DesignVersionComment = {
  id: number;
  design_version_id: number;
  body: string;
  author_name: string | null;
  created_at: string;
  updated_at: string;
};

export function designAssetKindLabel(kind: string): string {
  switch (kind) {
    case "layout":
      return "Макет";
    case "logo":
      return "Логотип";
    case "other":
      return "Прочее";
    default:
      return kind;
  }
}

export function designAssetContentAbsoluteUrl(contentUrl: string): string {
  return sameOriginApiMediaUrl(contentUrl) ?? contentUrl;
}

export async function fetchDesignVersionAssets(
  projectId: number | string,
  versionId: number | string,
): Promise<DesignVersionAsset[]> {
  const response = await fetch(
    `${apiBaseUrl()}/design-projects/${projectId}/versions/${versionId}/assets`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Не удалось загрузить активы версии"));
  }
  return (await response.json()) as DesignVersionAsset[];
}

export async function createDesignVersionAssetApi(
  projectId: number | string,
  versionId: number | string,
  payload: {
    filename: string;
    mime_type: string;
    content_base64: string;
    kind?: string;
    is_primary?: boolean;
    sort_order?: number;
  },
): Promise<DesignVersionAsset> {
  const response = await fetch(
    `${apiBaseUrl()}/design-projects/${projectId}/versions/${versionId}/assets`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Не удалось загрузить файл"));
  }
  return (await response.json()) as DesignVersionAsset;
}

export async function setDesignVersionAssetPrimaryApi(
  projectId: number | string,
  versionId: number | string,
  assetId: number | string,
): Promise<DesignVersionAsset> {
  const response = await fetch(
    `${apiBaseUrl()}/design-projects/${projectId}/versions/${versionId}/assets/${assetId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_primary: true }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Не удалось назначить primary"));
  }
  return (await response.json()) as DesignVersionAsset;
}

export async function deleteDesignVersionAssetApi(
  projectId: number | string,
  versionId: number | string,
  assetId: number | string,
): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl()}/design-projects/${projectId}/versions/${versionId}/assets/${assetId}`,
    { method: "DELETE", cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Не удалось удалить файл"));
  }
}

export async function fetchDesignVersionComments(
  projectId: number | string,
  versionId: number | string,
): Promise<DesignVersionComment[]> {
  const response = await fetch(
    `${apiBaseUrl()}/design-projects/${projectId}/versions/${versionId}/comments`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Не удалось загрузить комментарии"));
  }
  return (await response.json()) as DesignVersionComment[];
}

export async function createDesignVersionCommentApi(
  projectId: number | string,
  versionId: number | string,
  payload: { body: string; author_name?: string | null },
): Promise<DesignVersionComment> {
  const response = await fetch(
    `${apiBaseUrl()}/design-projects/${projectId}/versions/${versionId}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Не удалось добавить комментарий"));
  }
  return (await response.json()) as DesignVersionComment;
}

export async function deleteDesignVersionCommentApi(
  projectId: number | string,
  versionId: number | string,
  commentId: number | string,
): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl()}/design-projects/${projectId}/versions/${versionId}/comments/${commentId}`,
    { method: "DELETE", cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Не удалось удалить комментарий"));
  }
}
