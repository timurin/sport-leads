import "server-only";

import {
  fromApiSupplierDetail,
  fromApiSupplierListItem,
  type ApiSupplierDetail,
  type ApiSupplierListItem,
  type SupplierDetailView,
  type SupplierListView,
} from "@/lib/purchases/suppliers";

export type SuppliersLoadResult =
  | { ok: true; items: SupplierListView[] }
  | { ok: false; items: []; message: string };

export type SupplierDetailLoadResult =
  | { ok: true; supplier: SupplierDetailView }
  | { ok: false; supplier: null; message: string; notFound?: boolean };

function apiBaseUrl() {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export async function getSuppliersList(
  activeOnly = false,
): Promise<SuppliersLoadResult> {
  try {
    const response = await fetch(
      `${apiBaseUrl()}/suppliers?active_only=${activeOnly ? "true" : "false"}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return {
        ok: false,
        items: [],
        message: `Не удалось загрузить поставщиков (${response.status}).`,
      };
    }
    const body = (await response.json()) as ApiSupplierListItem[];
    return { ok: true, items: body.map(fromApiSupplierListItem) };
  } catch {
    return {
      ok: false,
      items: [],
      message: "Не удалось загрузить поставщиков. Demo-данные не подставлены.",
    };
  }
}

export async function getSupplierDetail(
  supplierId: string,
): Promise<SupplierDetailLoadResult> {
  if (!/^\d+$/.test(supplierId)) {
    return {
      ok: false,
      supplier: null,
      message: "Некорректный поставщик.",
      notFound: true,
    };
  }
  try {
    const response = await fetch(`${apiBaseUrl()}/suppliers/${supplierId}`, {
      cache: "no-store",
    });
    if (response.status === 404) {
      return {
        ok: false,
        supplier: null,
        message: "Поставщик не найден.",
        notFound: true,
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        supplier: null,
        message: `Не удалось загрузить поставщика (${response.status}).`,
      };
    }
    const body = (await response.json()) as ApiSupplierDetail;
    return { ok: true, supplier: fromApiSupplierDetail(body) };
  } catch {
    return {
      ok: false,
      supplier: null,
      message: "Не удалось загрузить поставщика. Demo-данные не подставлены.",
    };
  }
}
