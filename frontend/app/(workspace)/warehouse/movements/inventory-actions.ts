"use server";

import { revalidatePath } from "next/cache";

import {
  createInventoryDocument,
  fillInventoryDocument,
  postInventoryDocument,
  refreshInventoryBook,
  setInventoryCounted,
  type StockDocument,
} from "@/lib/stock-documents";

export type InventoryActionResult =
  | { ok: true; document: StockDocument }
  | { ok: false; message: string };

function revalidateInventory(document?: StockDocument | null) {
  revalidatePath("/warehouse/movements");
  if (document != null) {
    revalidatePath(`/warehouse/movements/${document.id}`);
  }
}

export async function createInventoryDocumentAction(
  warehouseId: number,
  fill: boolean,
): Promise<InventoryActionResult> {
  if (!Number.isSafeInteger(warehouseId) || warehouseId <= 0) {
    return { ok: false, message: "Укажите склад" };
  }
  try {
    const document = await createInventoryDocument({
      warehouse_id: warehouseId,
      fill,
    });
    revalidateInventory(document);
    return { ok: true, document };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось создать инвентаризацию",
    };
  }
}

export async function fillInventoryDocumentAction(
  documentId: number,
): Promise<InventoryActionResult> {
  try {
    const document = await fillInventoryDocument(documentId);
    revalidateInventory(document);
    return { ok: true, document };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось заполнить инвентаризацию",
    };
  }
}

export async function refreshInventoryBookAction(
  documentId: number,
): Promise<InventoryActionResult> {
  try {
    const document = await refreshInventoryBook(documentId);
    revalidateInventory(document);
    return { ok: true, document };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось обновить книгу",
    };
  }
}

export async function setInventoryCountedAction(
  documentId: number,
  nomenclatureId: number,
  countedQty: string,
): Promise<InventoryActionResult> {
  const qty = countedQty.trim().replace(",", ".");
  if (qty === "" || Number.isNaN(Number(qty)) || Number(qty) < 0) {
    return { ok: false, message: "Фактическое количество не может быть отрицательным" };
  }
  try {
    const document = await setInventoryCounted(
      documentId,
      nomenclatureId,
      qty,
    );
    revalidateInventory(document);
    return { ok: true, document };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Не удалось сохранить факт",
    };
  }
}

export async function postInventoryDocumentAction(
  documentId: number,
): Promise<InventoryActionResult> {
  try {
    const document = await postInventoryDocument(documentId);
    revalidateInventory(document);
    return { ok: true, document };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось провести инвентаризацию",
    };
  }
}
