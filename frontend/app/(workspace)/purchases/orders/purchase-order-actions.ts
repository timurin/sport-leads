"use server";

import {
  mapPurchaseOrderDetail,
  type ApiPurchaseOrderDetail,
  type PurchaseOrderCreateDraft,
} from "@/lib/purchases/purchase-orders";

type ActionResult =
  | { ok: true; id: number }
  | { ok: false; message: string };

type DetailResult =
  | { ok: true; order: ReturnType<typeof mapPurchaseOrderDetail> }
  | { ok: false; message: string };

function apiBaseUrl() {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

async function parseDetail(response: Response): Promise<DetailResult> {
  if (!response.ok) {
    let detail = `Ошибка ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* ignore */
    }
    return { ok: false, message: detail };
  }
  const body = (await response.json()) as ApiPurchaseOrderDetail;
  return { ok: true, order: mapPurchaseOrderDetail(body) };
}

export async function createPurchaseOrderRecord(
  draft: PurchaseOrderCreateDraft,
): Promise<ActionResult> {
  const supplierId = Number(draft.supplierId);
  if (!Number.isFinite(supplierId) || supplierId < 1) {
    return { ok: false, message: "Выберите поставщика" };
  }
  const payload: Record<string, unknown> = {
    supplier_id: supplierId,
    notes: draft.notes.trim() || null,
    lines: [],
  };
  if (draft.expectedDate.trim()) {
    payload.expected_date = draft.expectedDate.trim();
  }
  if (draft.warehouseId.trim()) {
    const warehouseId = Number(draft.warehouseId);
    if (!Number.isFinite(warehouseId) || warehouseId < 1) {
      return { ok: false, message: "Некорректный склад" };
    }
    payload.warehouse_id = warehouseId;
  }
  try {
    const response = await fetch(`${apiBaseUrl()}/purchase-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const parsed = await parseDetail(response);
    if (!parsed.ok) return parsed;
    return { ok: true, id: parsed.order.id };
  } catch {
    return { ok: false, message: "Не удалось создать заказ поставщику" };
  }
}

export async function savePurchaseOrderHeader(input: {
  orderId: number;
  expectedDate: string;
  warehouseId: string;
  notes: string;
}): Promise<DetailResult> {
  const payload: Record<string, unknown> = {
    notes: input.notes.trim() || null,
  };
  if (input.expectedDate.trim()) {
    payload.expected_date = input.expectedDate.trim();
    payload.clear_expected_date = false;
  } else {
    payload.clear_expected_date = true;
  }
  if (input.warehouseId.trim()) {
    const warehouseId = Number(input.warehouseId);
    if (!Number.isFinite(warehouseId) || warehouseId < 1) {
      return { ok: false, message: "Некорректный склад" };
    }
    payload.warehouse_id = warehouseId;
    payload.clear_warehouse = false;
  } else {
    payload.clear_warehouse = true;
  }
  try {
    const response = await fetch(
      `${apiBaseUrl()}/purchase-orders/${input.orderId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    return parseDetail(response);
  } catch {
    return { ok: false, message: "Не удалось сохранить шапку заказа" };
  }
}

export async function addPurchaseOrderLineRecord(input: {
  orderId: number;
  nomenclatureId: number;
  quantity: string;
  unitPrice: string;
  comment: string;
}): Promise<DetailResult> {
  const quantity = Number(input.quantity.replace(",", "."));
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, message: "Количество должно быть больше нуля" };
  }
  const payload: Record<string, unknown> = {
    nomenclature_id: input.nomenclatureId,
    quantity: String(quantity),
    comment: input.comment.trim() || null,
  };
  if (input.unitPrice.trim()) {
    const unitPrice = Number(input.unitPrice.replace(",", "."));
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return { ok: false, message: "Цена должна быть больше нуля" };
    }
    payload.unit_price = String(unitPrice);
  }
  try {
    const response = await fetch(
      `${apiBaseUrl()}/purchase-orders/${input.orderId}/lines`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    return parseDetail(response);
  } catch {
    return { ok: false, message: "Не удалось добавить строку" };
  }
}

export async function deletePurchaseOrderLineRecord(input: {
  orderId: number;
  lineId: number;
}): Promise<DetailResult> {
  try {
    const response = await fetch(
      `${apiBaseUrl()}/purchase-orders/${input.orderId}/lines/${input.lineId}`,
      { method: "DELETE" },
    );
    return parseDetail(response);
  } catch {
    return { ok: false, message: "Не удалось удалить строку" };
  }
}

export async function confirmPurchaseOrderRecord(
  orderId: number,
): Promise<DetailResult> {
  try {
    const response = await fetch(
      `${apiBaseUrl()}/purchase-orders/${orderId}/confirm`,
      { method: "POST" },
    );
    return parseDetail(response);
  } catch {
    return { ok: false, message: "Не удалось подтвердить заказ" };
  }
}

export async function cancelPurchaseOrderRecord(
  orderId: number,
): Promise<DetailResult> {
  try {
    const response = await fetch(
      `${apiBaseUrl()}/purchase-orders/${orderId}/cancel`,
      { method: "POST" },
    );
    return parseDetail(response);
  } catch {
    return { ok: false, message: "Не удалось отменить заказ" };
  }
}
