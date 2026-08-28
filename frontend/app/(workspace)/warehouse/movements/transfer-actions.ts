"use server";

import { revalidatePath } from "next/cache";

import {
  createTransferDocument,
  postTransferDocument,
  removeTransferLine,
  setTransferLine,
  type StockDocument,
} from "@/lib/stock-documents";

export type TransferActionResult =
  | { ok: true; document: StockDocument }
  | { ok: false; message: string };

function revalidateTransfer(document?: StockDocument | null) {
  revalidatePath("/warehouse/movements");
  if (document != null) {
    revalidatePath(`/warehouse/movements/${document.id}`);
  }
}

export async function createTransferDocumentAction(
  warehouseId: number,
  destinationWarehouseId: number,
): Promise<TransferActionResult> {
  if (!Number.isSafeInteger(warehouseId) || warehouseId <= 0) {
    return { ok: false, message: "Укажите склад-источник" };
  }
  if (
    !Number.isSafeInteger(destinationWarehouseId) ||
    destinationWarehouseId <= 0
  ) {
    return { ok: false, message: "Укажите склад-получатель" };
  }
  if (warehouseId === destinationWarehouseId) {
    return {
      ok: false,
      message: "Склад-получатель должен отличаться от склада-источника",
    };
  }
  try {
    const document = await createTransferDocument({
      warehouse_id: warehouseId,
      destination_warehouse_id: destinationWarehouseId,
    });
    revalidateTransfer(document);
    return { ok: true, document };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось создать перемещение",
    };
  }
}

export async function setTransferLineAction(
  documentId: number,
  nomenclatureId: number,
  quantity: string,
): Promise<TransferActionResult> {
  const qty = quantity.trim().replace(",", ".");
  if (qty === "" || Number.isNaN(Number(qty)) || Number(qty) <= 0) {
    return { ok: false, message: "Количество должно быть больше нуля" };
  }
  try {
    const document = await setTransferLine(documentId, nomenclatureId, qty);
    revalidateTransfer(document);
    return { ok: true, document };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось сохранить строку перемещения",
    };
  }
}

export async function removeTransferLineAction(
  documentId: number,
  nomenclatureId: number,
): Promise<TransferActionResult> {
  try {
    const document = await removeTransferLine(documentId, nomenclatureId);
    revalidateTransfer(document);
    return { ok: true, document };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось удалить строку перемещения",
    };
  }
}

export async function postTransferDocumentAction(
  documentId: number,
): Promise<TransferActionResult> {
  try {
    const document = await postTransferDocument(documentId);
    revalidateTransfer(document);
    return { ok: true, document };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось провести перемещение",
    };
  }
}
