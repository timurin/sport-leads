"use client";

import { ClipboardList, Factory, Plus, RefreshCw } from "lucide-react";

import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import {
  buildOrderTechCardsDemo,
  type OrderTechCardDemoRow,
  type TechCardDemoStatus,
} from "@/lib/sales/order-tech-cards-demo";
import type { SalesOrderDetails } from "@/lib/sales/order-details";

const statusTone: Record<TechCardDemoStatus, StatusBadgeTone> = {
  missing: "neutral",
  draft: "warning",
  in_progress: "primary",
  ready: "success",
  completed: "success",
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

function TechCardRow({ row }: { row: OrderTechCardDemoRow }) {
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
            {row.modelLabel} · {row.assemblyLabel}
          </p>
        </div>
        <div className="text-right text-[11px] text-portal-muted">
          <p>{row.quantity} ед.</p>
          <p className="mt-0.5">{row.unitLineCount} строк размеров</p>
        </div>
      </div>
      <div className="mt-3">
        <ProgressBar value={row.progressPercent} label={`Участок: ${row.currentStage}`} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button type="button" size="compact" variant="secondary" disabled={row.status === "missing"}>
          Открыть
        </Button>
        {row.status === "missing" ? (
          <Button type="button" size="compact" variant="primary" disabled>
            <Plus className="size-3.5" aria-hidden="true" /> Создать ТК
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export function SalesOrderTechCardsPanel({ order }: { order: SalesOrderDetails }) {
  const { rows, summary } = buildOrderTechCardsDemo({
    orderId: order.id,
    orderNumber: order.number,
    orderStatus: order.statusCode,
    items: order.items,
  });

  return (
    <SectionCard
      title="Технические карты"
      description="Интерфейс-заготовка под Stage 9 / 9.4.1: одна ТК на производимую позицию, сводный статус производства. Данные демо до persistent API."
      size="compact"
      className="min-w-0"
      actions={(
        <div className="flex flex-wrap items-center gap-1">
          <IconButton label="Обновить список (демо)" variant="secondary" disabled>
            <RefreshCw className="size-4" aria-hidden="true" />
          </IconButton>
          <Button type="button" size="compact" variant="primary" disabled>
            <Plus className="size-3.5" aria-hidden="true" /> Создать по позициям
          </Button>
        </div>
      )}
    >
      <div className="space-y-portal-3">
        <div className="rounded-portal-lg border border-portal-border bg-gradient-to-br from-portal-surface-secondary/70 to-portal-surface p-portal-3">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-portal-muted">
                <Factory size={13} aria-hidden="true" /> Готовность производства
              </p>
              <p className="mt-1 text-lg font-semibold text-portal-text">{summary.statusLabel}</p>
              <p className="mt-1 text-[11px] text-portal-muted">
                ТК: {summary.total} · в работе {summary.inProgressCount} · готовы {summary.readyCount + summary.completedCount} · нет {summary.missingCount}
              </p>
            </div>
            <StatusBadge
              size="compact"
              tone={summary.manufacturingComplete ? "success" : summary.missingCount > 0 ? "warning" : "primary"}
            >
              {summary.completenessPercent}%
            </StatusBadge>
          </div>
          <div className="mt-3">
            <ProgressBar value={summary.completenessPercent} label="Закрытие техкарт по заказу" />
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="Нет позиций для техкарт"
            description="Добавьте товарные позиции заказа — по каждой производимой строке будет одна техническая карта."
            icon={<ClipboardList className="size-5" aria-hidden="true" />}
          />
        ) : (
          <div className="grid min-w-0 gap-2">
            {rows.map((row) => (
              <TechCardRow key={row.id} row={row} />
            ))}
          </div>
        )}

        <p className="text-[11px] leading-4 text-portal-muted">
          Предлагаемый каркас: сводка готовности → список ТК по позициям (номер, модель, вариант, прогресс участка) → действия «Создать / Открыть». Persistent create/list — roadmap `9.2.1` / `9.4.1`.
        </p>
      </div>
    </SectionCard>
  );
}
