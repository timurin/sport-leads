import "server-only";

import type {
  ApiSpecification,
  ApiSpecificationListItem,
  SpecificationDetail,
  SpecificationListItem,
  SpecificationsListParams,
} from "@/lib/production/specifications";

export type SpecificationsLoadResult =
  | { ok: true; items: SpecificationListItem[] }
  | { ok: false; items: []; message: string };

export type SpecificationDetailLoadResult =
  | { ok: true; specification: SpecificationDetail }
  | { ok: false; specification: null; message: string; notFound?: boolean };

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

function buildListQuery(params: SpecificationsListParams): string {
  const query = new URLSearchParams();
  if (params.production_batch_id != null) {
    query.set("production_batch_id", String(params.production_batch_id));
  }
  if (params.production_order_id != null) {
    query.set("production_order_id", String(params.production_order_id));
  }
  if (params.sales_order_id != null) {
    query.set("sales_order_id", String(params.sales_order_id));
  }
  if (params.status?.trim()) query.set("status", params.status.trim());
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export async function getSpecificationsList(
  params: SpecificationsListParams = {},
): Promise<SpecificationsLoadResult> {
  try {
    const response = await fetch(
      `${apiBaseUrl()}/specifications${buildListQuery(params)}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return {
        ok: false,
        items: [],
        message: await readError(response, "Не удалось загрузить спецификации"),
      };
    }
    const body = (await response.json()) as ApiSpecificationListItem[];
    return { ok: true, items: body };
  } catch {
    return {
      ok: false,
      items: [],
      message: "Не удалось загрузить спецификации. Demo-данные не подставлены.",
    };
  }
}

export async function getSpecificationDetail(
  specificationId: string,
): Promise<SpecificationDetailLoadResult> {
  if (!/^\d+$/.test(specificationId)) {
    return {
      ok: false,
      specification: null,
      message: "Некорректная спецификация.",
      notFound: true,
    };
  }
  try {
    const response = await fetch(
      `${apiBaseUrl()}/specifications/${specificationId}`,
      { cache: "no-store" },
    );
    if (response.status === 404) {
      return {
        ok: false,
        specification: null,
        message: "Спецификация не найдена.",
        notFound: true,
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        specification: null,
        message: await readError(response, "Не удалось загрузить спецификацию"),
      };
    }
    const body = (await response.json()) as ApiSpecification;
    return { ok: true, specification: body };
  } catch {
    return {
      ok: false,
      specification: null,
      message: "Не удалось загрузить спецификацию. Demo-данные не подставлены.",
    };
  }
}

async function postSpecification(
  path: string,
  init?: RequestInit,
): Promise<
  | { ok: true; specification: SpecificationDetail }
  | { ok: false; message: string }
> {
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      method: "POST",
      cache: "no-store",
      ...init,
    });
    if (!response.ok) {
      return {
        ok: false,
        message: await readError(response, "Не удалось выполнить действие"),
      };
    }
    const body = (await response.json()) as ApiSpecification;
    return { ok: true, specification: body };
  } catch {
    return {
      ok: false,
      message: "Не удалось выполнить действие. Demo-данные не подставлены.",
    };
  }
}

export async function createSpecificationApi(productionBatchId: number) {
  return postSpecification("/specifications", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ production_batch_id: productionBatchId }),
  });
}

export async function refreshSpecificationApi(specificationId: number) {
  return postSpecification(`/specifications/${specificationId}/refresh`);
}

export async function createSpecificationNextDraftApi(specificationId: number) {
  return postSpecification(`/specifications/${specificationId}/new-draft`);
}

export async function approveSpecificationApi(specificationId: number) {
  return postSpecification(`/specifications/${specificationId}/approve`);
}

export async function cancelSpecificationDraftApi(specificationId: number) {
  return postSpecification(`/specifications/${specificationId}/cancel-draft`);
}
