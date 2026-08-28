import "server-only";

import {
  mapPurchaseOrderDetail,
  mapPurchaseOrderListItem,
  type ApiPurchaseOrderDetail,
  type ApiPurchaseOrderListItem,
  type PurchaseOrderDetailView,
  type PurchaseOrderListView,
} from "@/lib/purchases/purchase-orders";

export type PurchaseOrdersLoadResult =
  | { ok: true; items: PurchaseOrderListView[] }
  | { ok: false; items: []; message: string };

export type PurchaseOrderDetailLoadResult =
  | { ok: true; order: PurchaseOrderDetailView }
  | { ok: false; order: null; message: string; notFound?: boolean };

function apiBaseUrl() {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export async function getPurchaseOrdersList(): Promise<PurchaseOrdersLoadResult> {
  try {
    const response = await fetch(`${apiBaseUrl()}/purchase-orders`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        ok: false,
        items: [],
        message: `Не удалось загрузить заказы поставщикам (${response.status}).`,
      };
    }
    const body = (await response.json()) as ApiPurchaseOrderListItem[];
    return { ok: true, items: body.map(mapPurchaseOrderListItem) };
  } catch {
    return {
      ok: false,
      items: [],
      message:
        "Не удалось загрузить заказы поставщикам. Demo-данные не подставлены.",
    };
  }
}

export async function getPurchaseOrderDetail(
  orderId: string,
): Promise<PurchaseOrderDetailLoadResult> {
  if (!/^\d+$/.test(orderId)) {
    return {
      ok: false,
      order: null,
      message: "Некорректный заказ.",
      notFound: true,
    };
  }
  try {
    const response = await fetch(`${apiBaseUrl()}/purchase-orders/${orderId}`, {
      cache: "no-store",
    });
    if (response.status === 404) {
      return {
        ok: false,
        order: null,
        message: "Заказ поставщику не найден.",
        notFound: true,
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        order: null,
        message: `Не удалось загрузить заказ (${response.status}).`,
      };
    }
    const body = (await response.json()) as ApiPurchaseOrderDetail;
    return { ok: true, order: mapPurchaseOrderDetail(body) };
  } catch {
    return {
      ok: false,
      order: null,
      message: "Не удалось загрузить заказ. Demo-данные не подставлены.",
    };
  }
}
