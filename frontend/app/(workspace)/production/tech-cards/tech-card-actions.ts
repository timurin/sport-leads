"use server";

import { revalidatePath } from "next/cache";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import type { TechnicalCardPrintRequest } from "@/lib/production/tech-card-print";
import { shopStageCodeByTitle } from "@/lib/production/shop-stage-modules";
import {
  TECH_CARD_IMAGE_RULE,
  TECH_CARD_MEDIA_MAX,
  validateTechCardImageFile,
} from "@/lib/production/tech-cards";
import {
  applyTechnicalCardRouting,
  assignTechnicalCardPlannedWorkCenter,
  bulkUpdateTechnicalCardUnitLines,
  completeTechnicalCardStage,
  deleteTechnicalCardCompositionLine,
  deleteTechnicalCardMedia,
  generateOrderTechnicalCards,
  importTechnicalCardUnitLinesFile,
  importTechnicalCardUnitLines,
  replaceTechnicalCardUnitLines,
  replaceTechnicalCardComposition,
  rollbackTechnicalCardStage,
  rollbackTechnicalCardStageKanban,
  setTechnicalCardCompositionFactQty,
  setTechnicalCardMediaPrimary,
  startTechnicalCard,
  startTechnicalCardStage,
  updateTechnicalCardOperationLineVolume,
  updateTechnicalCardStageFact,
  uploadTechnicalCardMedia,
  type ApiTechnicalCard,
  type ApiTechnicalCardMedia,
  type TechnicalCardCompositionLineWrite,
  type TechnicalCardStageCompletePayload,
  type TechnicalCardStageFactPayload,
  type TechnicalCardStageStartPayload,
  type TechnicalCardUnitLineAggregateImportRow,
  type TechnicalCardUnitLineBulkUpdateItem,
  type TechnicalCardUnitLineWriteItem,
} from "@/lib/sales/order-tech-cards-api";

export type TechCardActionResult = {
  ok: boolean;
  message: string | null;
  card: ApiTechnicalCard | null;
};

function success(card: ApiTechnicalCard, message: string | null = null): TechCardActionResult {
  return { ok: true, message, card };
}

function failure(message: string): TechCardActionResult {
  return { ok: false, message, card: null };
}

function revalidateTechCardPaths(
  cardId: number | string,
  orderId?: number | string,
  shopStageCode?: string,
) {
  revalidatePath("/production/tech-cards");
  revalidatePath(`/production/tech-cards/${cardId}`);
  if (orderId != null) {
    revalidatePath(`/sales/orders/${orderId}`);
  }
  if (shopStageCode?.trim()) {
    revalidatePath(`/production/stages/${shopStageCode.trim()}`);
  }
  revalidatePath("/production/kanban");
}

export async function generateTechCardsFromOrderAction(
  orderId: string,
): Promise<TechCardActionResult & { generated: number }> {
  try {
    const result = await generateOrderTechnicalCards(orderId);
    const generated = result.created.length + result.revived.length;
    revalidatePath("/production/tech-cards");
    revalidatePath(`/sales/orders/${orderId}`);
    return {
      ok: true,
      message:
        generated === 0
          ? "Новых техкарт не создано (все eligible позиции уже имеют активную ТК)."
          : `Сформировано: создано ${result.created.length}, восстановлено ${result.revived.length}.`,
      card: null,
      generated,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Ошибка формирования техкарт",
      card: null,
      generated: 0,
    };
  }
}

export async function startTechnicalCardAction(
  cardId: number,
  orderId?: number,
): Promise<TechCardActionResult> {
  try {
    const card = await startTechnicalCard(cardId);
    revalidateTechCardPaths(cardId, orderId ?? card.sales_order_id);
    return success(card, "Техкарта запущена");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Не удалось запустить техкарту");
  }
}

export async function startTechnicalCardStageAction(
  cardId: number,
  stageOrder: number,
  payload: TechnicalCardStageStartPayload = {},
  orderId?: number,
): Promise<TechCardActionResult> {
  try {
    const card = await startTechnicalCardStage(cardId, stageOrder, payload);
    revalidateTechCardPaths(cardId, orderId ?? card.sales_order_id);
    return success(card, "Этап запущен");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Не удалось запустить этап");
  }
}

export async function completeTechnicalCardStageAction(
  cardId: number,
  stageOrder: number,
  payload: TechnicalCardStageCompletePayload = {},
  orderId?: number,
  shopStageCode?: string,
): Promise<TechCardActionResult> {
  try {
    const card = await completeTechnicalCardStage(cardId, stageOrder, payload);
    revalidateTechCardPaths(cardId, orderId ?? card.sales_order_id, shopStageCode);
    const nextCode = shopStageCodeByTitle(card.current_stage_label);
    if (nextCode && nextCode !== shopStageCode?.trim()) {
      revalidatePath(`/production/stages/${nextCode}`);
    }
    const nextLabel = card.current_stage_label?.trim();
    const message =
      card.status === "completed"
        ? "Этап завершён · техкарта выполнена"
        : nextLabel
          ? `Этап завершён · следующий: ${nextLabel}`
          : "Этап завершён";
    return success(card, message);
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Не удалось завершить этап");
  }
}

export async function rollbackTechnicalCardStageAction(
  cardId: number,
  stageOrder: number,
  orderId?: number,
): Promise<TechCardActionResult> {
  try {
    const card = await rollbackTechnicalCardStage(cardId, stageOrder);
    revalidateTechCardPaths(cardId, orderId ?? card.sales_order_id);
    return success(card, "Этап возвращён в работу");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Не удалось откатить этап");
  }
}

export async function rollbackTechnicalCardStageKanbanAction(
  cardId: number,
  stageOrder: number,
  orderId?: number,
): Promise<TechCardActionResult> {
  try {
    const card = await rollbackTechnicalCardStageKanban(cardId, stageOrder);
    revalidateTechCardPaths(cardId, orderId ?? card.sales_order_id);
    return success(card, "Этап возвращён в работу (kanban)");
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Не удалось откатить этап (kanban)",
    );
  }
}

export async function applyRoutingAction(
  cardId: number,
  routingTemplateId: number,
  orderId?: number,
): Promise<TechCardActionResult> {
  try {
    const card = await applyTechnicalCardRouting(cardId, routingTemplateId);
    revalidateTechCardPaths(cardId, orderId ?? card.sales_order_id);
    return success(card, "Маршрут применён");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Не удалось применить маршрут");
  }
}

export async function replaceCompositionAction(
  cardId: number,
  lines: TechnicalCardCompositionLineWrite[],
  orderId?: number,
): Promise<TechCardActionResult> {
  try {
    const card = await replaceTechnicalCardComposition(cardId, lines);
    revalidateTechCardPaths(cardId, orderId ?? card.sales_order_id);
    return success(card, "Состав материалов сохранён");
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Не удалось сохранить состав материалов",
    );
  }
}

export async function setCompositionFactQtyAction(
  cardId: number,
  lineId: number,
  factQty: string | number,
  orderId?: number,
  shopStageCode?: string,
): Promise<TechCardActionResult> {
  try {
    const card = await setTechnicalCardCompositionFactQty(
      cardId,
      lineId,
      factQty,
      shopStageCode,
    );
    revalidateTechCardPaths(cardId, orderId ?? card.sales_order_id, shopStageCode);
    return success(card, "Факт по материалу сохранён");
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Не удалось сохранить факт по материалу",
    );
  }
}

export async function deleteCompositionLineAction(
  cardId: number,
  lineId: number,
  orderId?: number,
  shopStageCode?: string,
): Promise<TechCardActionResult> {
  try {
    const card = await deleteTechnicalCardCompositionLine(
      cardId,
      lineId,
      shopStageCode,
    );
    revalidateTechCardPaths(cardId, orderId ?? card.sales_order_id, shopStageCode);
    return success(card, "Материал удалён");
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Не удалось удалить материал",
    );
  }
}

export async function updateOperationLineVolumeAction(
  cardId: number,
  lineId: number,
  volume: string | number,
  orderId?: number,
  shopStageCode?: string,
): Promise<TechCardActionResult> {
  try {
    const card = await updateTechnicalCardOperationLineVolume(
      cardId,
      lineId,
      volume,
      shopStageCode,
    );
    revalidateTechCardPaths(cardId, orderId ?? card.sales_order_id, shopStageCode);
    return success(card, "Объём операции сохранён");
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Не удалось сохранить объём операции",
    );
  }
}

export async function updateStageFactAction(
  cardId: number,
  stageOrder: number,
  payload: TechnicalCardStageFactPayload,
  orderId?: number,
  shopStageCode?: string,
): Promise<TechCardActionResult> {
  try {
    const card = await updateTechnicalCardStageFact(cardId, stageOrder, payload);
    revalidateTechCardPaths(
      cardId,
      orderId ?? card.sales_order_id,
      shopStageCode ?? payload.shop_stage_code ?? undefined,
    );
    return success(card, "Факт этапа сохранён");
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Не удалось сохранить факт этапа",
    );
  }
}

export async function assignPlannedWorkCenterAction(
  cardId: number,
  stageOrder: number,
  workCenterId: number | null,
  orderId?: number,
): Promise<TechCardActionResult> {
  try {
    const card = await assignTechnicalCardPlannedWorkCenter(
      cardId,
      stageOrder,
      workCenterId,
    );
    revalidateTechCardPaths(cardId, orderId ?? card.sales_order_id);
    return success(card, "Оборудование этапа сохранено");
  } catch (error) {
    return failure(
      error instanceof Error
        ? error.message
        : "Не удалось сохранить оборудование этапа",
    );
  }
}

export async function importUnitLinesAction(
  cardId: number,
  lines: TechnicalCardUnitLineAggregateImportRow[],
  orderId?: number,
): Promise<TechCardActionResult> {
  try {
    const card = await importTechnicalCardUnitLines(cardId, lines);
    revalidateTechCardPaths(cardId, orderId ?? card.sales_order_id);
    return success(card, "Поштучные данные импортированы");
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Не удалось импортировать поштучные данные",
    );
  }
}

export async function importUnitLinesFileAction(
  cardId: number,
  formData: FormData,
  orderId?: number,
): Promise<TechCardActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return failure("Выберите XLSX-файл для импорта");
  }
  try {
    const payload = new FormData();
    payload.append("file", file);
    const card = await importTechnicalCardUnitLinesFile(cardId, payload);
    revalidateTechCardPaths(cardId, orderId ?? card.sales_order_id);
    return success(card, "Поштучные данные импортированы из XLSX");
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Не удалось импортировать XLSX-файл",
    );
  }
}

export async function bulkUpdateUnitLinesAction(
  cardId: number,
  lines: TechnicalCardUnitLineBulkUpdateItem[],
  orderId?: number,
): Promise<TechCardActionResult> {
  if (lines.length === 0) {
    return failure("Нет строк для сохранения");
  }
  try {
    const card = await bulkUpdateTechnicalCardUnitLines(cardId, lines);
    revalidateTechCardPaths(cardId, orderId ?? card.sales_order_id);
    return success(card, "Поштучные строки сохранены");
  } catch (error) {
    return failure(
      error instanceof Error
        ? error.message
        : "Не удалось сохранить поштучные строки",
    );
  }
}

export async function replaceUnitLinesAction(
  cardId: number,
  lines: TechnicalCardUnitLineWriteItem[],
  orderId?: number,
): Promise<TechCardActionResult> {
  if (lines.length === 0) {
    return failure("Нет строк для сохранения");
  }
  try {
    const card = await replaceTechnicalCardUnitLines(cardId, lines);
    revalidateTechCardPaths(cardId, orderId ?? card.sales_order_id);
    return success(card, "Поштучные строки сохранены");
  } catch (error) {
    return failure(
      error instanceof Error
        ? error.message
        : "Не удалось сохранить поштучные строки",
    );
  }
}

export type TechCardMediaActionResult = {
  ok: boolean;
  message: string | null;
  media: ApiTechnicalCardMedia[];
};

export type TechCardPrintFormRender = {
  print_form_id: number;
  print_form_code: string;
  version_id: number;
  version_no: number;
  output_format: string;
  content_type: string;
  file_name: string;
  content: string;
  content_encoding?: string;
  is_preview: boolean;
};

export type TechCardPrintActionResult = {
  ok: boolean;
  message: string;
  render: TechCardPrintFormRender | null;
};

function mediaSuccess(
  media: ApiTechnicalCardMedia[],
  message: string | null = null,
): TechCardMediaActionResult {
  return { ok: true, message, media };
}

function mediaFailure(message: string): TechCardMediaActionResult {
  return { ok: false, message, media: [] };
}

function apiBaseUrl(): string {
  return (
    process.env.SPORT_LEADS_API_URL ??
    process.env.NEXT_PUBLIC_SPORT_LEADS_API_URL ??
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
}

export async function generateTechnicalCardPrintForm(
  request: TechnicalCardPrintRequest,
): Promise<TechCardPrintActionResult> {
  try {
    const auth = await sessionAuthHeaders();
    const response = await fetch(`${apiBaseUrl()}/print-forms/generate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...auth,
      },
      body: JSON.stringify(request),
      cache: "no-store",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { detail?: string }
        | null;
      return {
        ok: false,
        message:
          payload?.detail ??
          `Не удалось сформировать печатную форму (${response.status}).`,
        render: null,
      };
    }
    return {
      ok: true,
      message: "Печатная форма сформирована.",
      render: (await response.json()) as TechCardPrintFormRender,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Не удалось сформировать печатную форму",
      render: null,
    };
  }
}

export async function uploadTechCardMediaAction(
  cardId: number,
  formData: FormData,
  options?: { currentCount?: number; orderId?: number },
): Promise<TechCardMediaActionResult> {
  try {
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (files.length === 0) {
      return mediaFailure(TECH_CARD_IMAGE_RULE);
    }

    const currentCount =
      typeof options?.currentCount === "number" && Number.isFinite(options.currentCount)
        ? Math.max(0, options.currentCount)
        : null;
    if (currentCount != null && currentCount + files.length > TECH_CARD_MEDIA_MAX) {
      return mediaFailure(`Можно загрузить не более ${TECH_CARD_MEDIA_MAX} изображений`);
    }

    const makePrimary = String(formData.get("is_primary") ?? "") === "1";
    const uploaded: ApiTechnicalCardMedia[] = [];
    for (const [index, file] of files.entries()) {
      const invalid = validateTechCardImageFile(file);
      if (invalid) return mediaFailure(invalid);
      const content_base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      uploaded.push(
        await uploadTechnicalCardMedia(cardId, {
          filename: file.name,
          mime_type: file.type,
          content_base64,
          is_primary: makePrimary && index === 0,
        }),
      );
    }

    revalidateTechCardPaths(cardId, options?.orderId);
    return mediaSuccess(uploaded, "Изображение загружено");
  } catch (error) {
    return mediaFailure(error instanceof Error ? error.message : "Не удалось загрузить изображение");
  }
}

export async function setTechCardMediaPrimaryAction(
  cardId: number,
  mediaId: number,
  orderId?: number,
): Promise<TechCardMediaActionResult> {
  try {
    const media = await setTechnicalCardMediaPrimary(cardId, mediaId);
    revalidateTechCardPaths(cardId, orderId);
    return mediaSuccess([media], "Основное изображение обновлено");
  } catch (error) {
    return mediaFailure(
      error instanceof Error ? error.message : "Не удалось назначить основное изображение",
    );
  }
}

export async function deleteTechCardMediaAction(
  cardId: number,
  mediaId: number,
  orderId?: number,
): Promise<TechCardMediaActionResult> {
  try {
    await deleteTechnicalCardMedia(cardId, mediaId);
    revalidateTechCardPaths(cardId, orderId);
    return mediaSuccess([], "Изображение удалено");
  } catch (error) {
    return mediaFailure(error instanceof Error ? error.message : "Не удалось удалить изображение");
  }
}
