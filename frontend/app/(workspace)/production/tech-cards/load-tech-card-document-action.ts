"use server";

import { loadTechnicalCardDocument } from "@/lib/production/load-tech-card-document";

export async function loadTechnicalCardWorkspace(cardId: number) {
  if (!Number.isSafeInteger(cardId) || cardId <= 0) {
    return { ok: false as const, message: "Некорректный идентификатор техкарты" };
  }
  try {
    const document = await loadTechnicalCardDocument(cardId);
    if (!document) return { ok: false as const, message: "Техкарта не найдена" };
    return { ok: true as const, document };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Не удалось открыть техкарту",
    };
  }
}
