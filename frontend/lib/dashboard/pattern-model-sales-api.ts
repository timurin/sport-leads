import "server-only";

import type {
  PatternModelSalesResult,
  PatternModelSalesRow,
} from "@/lib/dashboard/pattern-model-sales-types";

export type { PatternModelSalesResult, PatternModelSalesRow };

function apiBaseUrl() {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function getPatternModelSales(params: {
  dateFrom: Date;
  dateTo: Date;
  article?: string;
  limit?: number;
}): Promise<PatternModelSalesResult> {
  const search = new URLSearchParams({
    date_from: toIsoDate(params.dateFrom),
    date_to: toIsoDate(params.dateTo),
    limit: String(params.limit ?? 20),
  });
  if (params.article?.trim()) {
    search.set("article", params.article.trim());
  }

  try {
    const response = await fetch(
      `${apiBaseUrl()}/analytics/pattern-model-sales?${search.toString()}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return {
        ok: false,
        items: [],
        message: `Не удалось загрузить аналитику моделей (${response.status}).`,
      };
    }
    const body = (await response.json()) as { items: PatternModelSalesRow[] };
    return { ok: true, items: body.items ?? [] };
  } catch {
    return {
      ok: false,
      items: [],
      message: "Не удалось связаться с backend для аналитики моделей.",
    };
  }
}
