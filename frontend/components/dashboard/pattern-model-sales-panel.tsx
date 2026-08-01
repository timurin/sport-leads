"use client";

import { useEffect, useState, useTransition } from "react";

import { loadPatternModelSalesAction } from "@/app/(workspace)/sales/dashboard/pattern-model-sales-actions";
import { currency } from "@/lib/dashboard/sales-dashboard";
import type { PatternModelSalesRow } from "@/lib/dashboard/pattern-model-sales-types";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SectionCard } from "@/components/ui/section-card";

const numberFmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export function PatternModelSalesPanel({
  dateFrom,
  dateTo,
  rangeLabel,
}: {
  dateFrom: string;
  dateTo: string;
  rangeLabel: string;
}) {
  const [article, setArticle] = useState("");
  const [draftArticle, setDraftArticle] = useState("");
  const [items, setItems] = useState<PatternModelSalesRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      const result = await loadPatternModelSalesAction({
        dateFrom,
        dateTo,
        article,
      });
      if (cancelled) return;
      if (!result.ok) {
        setItems([]);
        setError(result.message);
        return;
      }
      setError(null);
      setItems(result.items);
    });
    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo, article]);

  return (
    <SectionCard
      title="Топ моделей (лекала)"
      description={`Живые данные API · ${rangeLabel}. «Ед. выпуск» = qty в заказах ready/shipped/completed.`}
    >
      <form
        className="mb-portal-3 flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setArticle(draftArticle);
        }}
      >
        <Input
          className="w-full max-w-xs"
          value={draftArticle}
          placeholder="Фильтр по артикулу"
          aria-label="Фильтр артикула модели"
          onChange={(event) => setDraftArticle(event.target.value)}
        />
        <Button type="submit" disabled={isPending}>
          Применить
        </Button>
        {isPending ? (
          <span className="text-[11px] text-portal-muted">Обновление…</span>
        ) : null}
      </form>
      {error ? (
        <InlineAlert tone="danger" className="mb-portal-3">
          {error}
        </InlineAlert>
      ) : null}
      {!error && items.length === 0 ? (
        <EmptyState
          title="Нет строк по моделям"
          description="За период нет позиций заказа с привязанной моделью/артикулом."
        />
      ) : null}
      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-portal-body">
            <thead>
              <tr className="border-b border-portal-border text-portal-caption font-semibold uppercase tracking-wide text-portal-muted">
                <th className="pb-portal-3">Артикул</th>
                <th className="pb-portal-3">Модель</th>
                <th className="pb-portal-3 text-right">Заказов</th>
                <th className="pb-portal-3 text-right">Ед. заказ</th>
                <th className="pb-portal-3 text-right">Ед. выпуск</th>
                <th className="pb-portal-3 text-right">Сумма</th>
                <th className="pb-portal-3 text-right">Пошив</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={`${row.product_model_id ?? "x"}-${row.product_model_article}`}
                  className="border-b border-portal-border/60 last:border-0"
                >
                  <td className="py-portal-3 font-medium text-portal-text">
                    {row.product_model_article}
                  </td>
                  <td className="py-portal-3 text-portal-muted">
                    {row.product_model_name ?? "—"}
                  </td>
                  <td className="py-portal-3 text-right">{numberFmt.format(row.order_count)}</td>
                  <td className="py-portal-3 text-right">
                    {numberFmt.format(row.units_ordered)}
                  </td>
                  <td className="py-portal-3 text-right">
                    {numberFmt.format(row.units_manufactured)}
                  </td>
                  <td className="py-portal-3 text-right font-medium">
                    {currency.format(row.order_amount)}
                  </td>
                  <td className="py-portal-3 text-right">
                    {currency.format(row.sewing_cost_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </SectionCard>
  );
}
