"use client";

import { ClipboardList, ExternalLink, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";

import {
  generateOrderTechCardsAction,
  loadOrderTechCardsState,
  type OrderTechCardsState,
} from "@/app/(workspace)/sales/orders/[orderId]/order-tech-card-actions";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import type {
  OrderTechCardRow,
  OrderTechCardStageStripKind,
} from "@/lib/sales/order-tech-cards";
import type { SalesOrderDetails } from "@/lib/sales/order-details";

const stripClass: Record<OrderTechCardStageStripKind, string> = {
  done: "bg-portal-success",
  active: "bg-portal-primary",
  upcoming: "bg-portal-border",
};

const stripKindLabel: Record<OrderTechCardStageStripKind, string> = {
  done: "закрыт",
  active: "текущий",
  upcoming: "впереди",
};

function ReadinessBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-portal-muted">Готовность</span>
        <span className="text-[11px] font-semibold tabular-nums text-portal-text">{clamped}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-portal-surface-secondary"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Готовность к отгрузке"
        data-order-tech-cards-readiness
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-portal-primary to-cyan-400 transition-[width]"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function TechCardMini({ row }: { row: OrderTechCardRow }) {
  return (
    <article
      className="min-w-0 rounded-portal-md border border-portal-border bg-portal-surface p-portal-3 shadow-portal-sm"
      data-order-tech-card-mini
    >
      <div className="flex min-w-0 items-start gap-1">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-portal-text" title={row.title}>
          {row.title}
        </p>
        {row.href ? (
          <Link
            href={row.href}
            aria-label="Открыть"
            title="Открыть"
            className="inline-flex size-portal-control-icon shrink-0 items-center justify-center rounded-portal-md text-portal-muted hover:bg-portal-state-hover hover:text-portal-text"
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </Link>
        ) : (
          <span className="inline-flex size-portal-control-icon shrink-0 items-center justify-center text-portal-border" aria-hidden="true">
            <ExternalLink className="size-3.5" />
          </span>
        )}
      </div>
      {row.stageStrips.length > 0 ? (
        <div
          className="mt-2 flex min-w-0 gap-0.5"
          role="list"
          aria-label="Этапы маршрута"
        >
          {row.stageStrips.map((strip) => (
            <div
              key={strip.order}
              role="listitem"
              title={`${strip.label}: ${stripKindLabel[strip.kind]}`}
              data-stage-strip={strip.kind}
              className={`h-1.5 min-w-0 flex-1 rounded-full ${stripClass[strip.kind]}`}
            />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-portal-muted">Нет маршрута</p>
      )}
    </article>
  );
}

export function SalesOrderTechCardsPanel({
  order,
  collapsed = false,
  headerActions,
}: {
  order: SalesOrderDetails;
  collapsed?: boolean;
  headerActions?: ReactNode;
}) {
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
      afterTitle={summary ? <ReadinessBar value={summary.readinessPercent} /> : null}
      description="Одна ТК на производимую позицию (PRODUCT). Данные из API `9.2.1` — без демо-подстановки."
      size="compact"
      className="min-w-0"
      collapsed={collapsed}
      actions={(
        <div className="flex flex-wrap items-center gap-1">
          {headerActions}
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

        {!error && state && rows.length === 0 ? (
          <EmptyState
            title="Нет производимых позиций"
            description="Техкарты создаются только для строк с номенклатурой типа Продукция (PRODUCT)."
            icon={<ClipboardList className="size-5" aria-hidden="true" />}
          />
        ) : null}

        {!error && rows.length > 0 ? (
          <div
            className="grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-3"
            data-order-tech-cards-grid
          >
            {rows.map((row) => (
              <TechCardMini key={row.key} row={row} />
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
