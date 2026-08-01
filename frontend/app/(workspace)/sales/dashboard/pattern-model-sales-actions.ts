"use server";

import {
  getPatternModelSales,
  type PatternModelSalesResult,
} from "@/lib/dashboard/pattern-model-sales-api";

export async function loadPatternModelSalesAction(input: {
  dateFrom: string;
  dateTo: string;
  article?: string;
}): Promise<PatternModelSalesResult> {
  const from = new Date(`${input.dateFrom}T00:00:00`);
  const to = new Date(`${input.dateTo}T23:59:59`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { ok: false, items: [], message: "Некорректный период." };
  }
  return getPatternModelSales({
    dateFrom: from,
    dateTo: to,
    article: input.article,
    limit: 20,
  });
}
