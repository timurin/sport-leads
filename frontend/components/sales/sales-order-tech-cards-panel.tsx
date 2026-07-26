"use client";

import { ClipboardList, ExternalLink, Factory, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";

import {
  generateOrderTechCardsAction,
  loadOrderTechCardsState,
  type OrderTechCardsState,
} from "@/app/(workspace)/sales/orders/[orderId]/order-tech-card-actions";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import type { OrderTechCardRow, TechCardUiStatus } from "@/lib/sales/order-tech-cards";
import type { SalesOrderDetails } from "@/lib/sales/order-details";

const statusTone: Record<TechCardUiStatus, StatusBadgeTone> = {
  missing: "neutral",
  draft: "warning",
  in_progress: "primary",
  completed: "success",
  cancelled: "neutral",
};

function ProgressBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-portal-muted">{label}</span>
        <span className="text-[11px] font-semibold tabular-nums text-portal-text">{clamped}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-portal-surface-secondary"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-portal-primary transition-[width]"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function TechCardRow({ row }: { row: OrderTechCardRow }) {
  return (
    <article className="min-w-0 rounded-portal-md border border-portal-border bg-portal-surface p-portal-3 shadow-portal-sm">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-portal-text">
              {row.number === "—" ? `Позиция ${row.position}` : row.number}
            </p>
            <StatusBadge size="compact" tone={statusTone[row.status]}>
              {row.statusLabel}
            </StatusBadge>
          </div>
          <p className="mt-1 truncate text-sm text-portal-text">{row.productName}</p>
          <p className="mt-0.5 truncate text-[11px] text-portal-muted">
            Участок: {row.currentStage}
          </p>
        </div>
        <div className="text-right text-[11px] text-portal-muted">
          <p>{row.quantity} ед.</p>
          <p className="mt-0.5">
            {row.unitLineCount == null ? "—" : `${row.unitLineCount} строк размеров`}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {row.href ? (
          <Link
            href={row.href}
            className="inline-flex h-portal-control-compact items-center justify-center gap-portal-1 rounded-portal-sm border border-portal-border bg-portal-surface px-portal-3 text-portal-caption font-medium text-portal-text hover:bg-portal-state-hover"
          >
            Открыть
          </Link>
        ) : (
          <Button type="button" size="compact" variant="secondary" disabled>
            Открыть
          </Button>
        )}
      </div>
    </article>
  );
}

export function SalesOrderTechCardsPanel({ order }: { order: SalesOrderDetails }) {
  const [state, setState] = useState<OrderTechCardsState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const next = await loadOrderTechCardsState(order.id);
      setState(next);
      setError(next.ok ? null : next.message);
    });
  }, [order.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onGenerate = () => {
    startTransition(async () => {
      const next = await generateOrderTechCardsAction(order.id);
      setState(next);
      setError(next.ok ? null : next.message);
    });
  };

  const summary = state?.summary ?? null;
  const canGenerate = (state?.createCount ?? 0) + (state?.reviveCount ?? 0) > 0;
  const rows = state?.rows ?? [];
  const successMessage = state?.ok ? state.message : null;

  return (
    <SectionCard
      title="Технические карты"
      description="Одна ТК на производимую позицию (PRODUCT). Данные из API `9.2.1` — без демо-подстановки."
      size="compact"
      className="min-w-0"
      actions={(
        <div className="flex flex-wrap items-center gap-1">
          <IconButton
            label="Обновить список техкарт"
            variant="secondary"
            disabled={isPending}
            onClick={refresh}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </IconButton>
          {summary ? (
            <Link
              href={summary.openListHref}
              className="inline-flex h-portal-control-compact items-center justify-center gap-portal-1 rounded-portal-sm border border-portal-border bg-portal-surface px-portal-3 text-portal-caption font-medium text-portal-text hover:bg-portal-state-hover"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" /> Список
            </Link>
          ) : null}
          <Button
            type="button"
            size="compact"
            variant="primary"
            disabled={isPending || !canGenerate}
            onClick={onGenerate}
          >
            <Plus className="size-3.5" aria-hidden="true" /> Сформировать из заказа
          </Button>
        </div>
      )}
    >
      <div className="space-y-portal-3">
        {successMessage ? (
          <p className="rounded-portal-md border border-portal-border bg-portal-surface-secondary px-portal-3 py-2 text-[11px] text-portal-text">
            {successMessage}
          </p>
        ) : null}

        {error ? (
          <EmptyState
            title="Не удалось загрузить техкарты"
            description={error}
            icon={<ClipboardList className="size-5" aria-hidden="true" />}
          />
        ) : null}

        {!error && summary ? (
          <div className="rounded-portal-lg border border-portal-border bg-gradient-to-br from-portal-surface-secondary/70 to-portal-surface p-portal-3">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-portal-muted">
                  <Factory size={13} aria-hidden="true" /> Готовность производства
                </p>
                <p className="mt-1 text-lg font-semibold text-portal-text">{summary.statusLabel}</p>
                <p className="mt-1 text-[11px] text-portal-muted">
                  Eligible: {summary.eligibleCount} · активных {summary.presentCount - summary.cancelledCount} · в работе{" "}
                  {summary.inProgressCount + summary.draftCount} · завершены {summary.completedCount} · нет/отм.{" "}
                  {summary.missingCount}
                </p>
              </div>
              <StatusBadge
                size="compact"
                tone={
                  summary.manufacturingComplete
                    ? "success"
                    : summary.missingCount > 0
                      ? "warning"
                      : "primary"
                }
              >
                {summary.completenessPercent}%
              </StatusBadge>
            </div>
            <div className="mt-3">
              <ProgressBar value={summary.completenessPercent} label="Закрытие техкарт по заказу" />
            </div>
          </div>
        ) : null}

        {!error && state && rows.length === 0 ? (
          <EmptyState
            title="Нет производимых позиций"
            description="Техкарты создаются только для строк с номенклатурой типа Продукция (PRODUCT)."
            icon={<ClipboardList className="size-5" aria-hidden="true" />}
          />
        ) : null}

        {!error && rows.length > 0 ? (
          <div className="grid min-w-0 gap-2">
            {rows.map((row) => (
              <TechCardRow key={row.key} row={row} />
            ))}
          </div>
        ) : null}

        {!state && !error ? (
          <p className="text-[11px] text-portal-muted">Загрузка техкарт…</p>
        ) : null}
      </div>
    </SectionCard>
  );
}
