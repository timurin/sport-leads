"use client";

import type { ReactNode } from "react";
import {
  CalendarClock,
  Factory,
  ListTodo,
  MessageSquare,
  Package,
  Percent,
  Scissors,
  Wallet,
} from "lucide-react";

import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import type { OrderCardMetricsModel } from "@/lib/sales/order-card-metrics";

function ProgressBar({
  value,
  tone = "primary",
  label,
}: {
  value: number;
  tone?: "primary" | "success" | "warning" | "danger";
  label: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const fill = {
    primary: "bg-portal-primary",
    success: "bg-portal-success",
    warning: "bg-portal-warning",
    danger: "bg-portal-danger",
  }[tone];
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
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
        <div className={`h-full rounded-full transition-[width] duration-300 ${fill}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  detail,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
}) {
  const valueColor = {
    default: "text-portal-text",
    primary: "text-portal-primary",
    success: "text-portal-success",
    warning: "text-portal-warning",
    danger: "text-portal-danger",
  }[tone];
  return (
    <article className="min-w-0 rounded-portal-md border border-portal-border bg-portal-surface px-3 py-2.5 shadow-portal-sm">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-portal-muted">{icon}</span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-portal-muted">{label}</p>
          <p className={`mt-0.5 truncate text-sm font-semibold tabular-nums ${valueColor}`}>{value}</p>
          {detail ? <p className="mt-0.5 truncate text-[11px] text-portal-muted">{detail}</p> : null}
        </div>
      </div>
    </article>
  );
}

const paymentTone: Record<OrderCardMetricsModel["paymentStatus"], StatusBadgeTone> = {
  unpaid: "neutral",
  partial: "warning",
  paid: "success",
  refunded: "danger",
};

export function SalesOrderMetrics({ metrics }: { metrics: OrderCardMetricsModel }) {
  const paymentProgressTone = metrics.paidPercent >= 100
    ? "success"
    : metrics.paidPercent > 0
      ? "warning"
      : "danger";
  const productionTone = metrics.productionPercent >= 88
    ? "success"
    : metrics.productionPercent >= 40
      ? "primary"
      : "warning";

  return (
    <div className="space-y-3" data-order-metrics data-demo-enriched="">
      <div className="rounded-portal-lg border border-portal-border bg-gradient-to-br from-portal-surface-secondary/80 to-portal-surface p-3.5 shadow-portal-sm">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-portal-muted">
              <Wallet size={13} aria-hidden="true" /> Сумма заказа
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-portal-success tabular-nums">
              {metrics.amountLabel}
            </p>
            <p className="mt-1 text-[11px] text-portal-muted">
              Оплачено {metrics.paidAmountLabel} · маржа (демо) {metrics.marginPercent}%
            </p>
          </div>
          <StatusBadge tone={paymentTone[metrics.paymentStatus]} size="compact">
            {metrics.paymentLabel}
          </StatusBadge>
        </div>
        <div className="mt-3 space-y-2.5">
          <ProgressBar value={metrics.paidPercent} tone={paymentProgressTone} label="Оплата (демо)" />
          <ProgressBar value={metrics.productionPercent} tone={productionTone} label={metrics.productionLabel} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MiniStat
          icon={<Package size={14} aria-hidden="true" />}
          label="Позиции / изделия"
          value={`${metrics.itemCount} / ${metrics.unitsPlanned}`}
          detail="строки и план единиц"
        />
        <MiniStat
          icon={<Scissors size={14} aria-hidden="true" />}
          label="Стоимость пошива"
          value={metrics.sewingCostLabel}
          detail={metrics.sewingCostSource === "items" ? "из вариантов сборки" : "демо-оценка 18%"}
          tone="primary"
        />
        <MiniStat
          icon={<Factory size={14} aria-hidden="true" />}
          label="Производство"
          value={`${metrics.productionPercent}%`}
          detail={metrics.productionLabel}
        />
        <MiniStat
          icon={<Percent size={14} aria-hidden="true" />}
          label="Маржа (демо)"
          value={`${metrics.marginPercent}%`}
          detail="после ткани и пошива"
          tone={metrics.marginPercent >= 30 ? "success" : metrics.marginPercent >= 15 ? "warning" : "danger"}
        />
        <MiniStat
          icon={<CalendarClock size={14} aria-hidden="true" />}
          label="Срок / SLA"
          value={metrics.slaLabel}
          detail={`Желаемая: ${metrics.desiredDateLabel}`}
          tone={metrics.slaTone === "default" ? "default" : metrics.slaTone}
        />
        <MiniStat
          icon={<CalendarClock size={14} aria-hidden="true" />}
          label="Дней в работе"
          value={`${metrics.daysInWork} дн.`}
          detail={`с ${metrics.createdAtLabel}`}
        />
        <MiniStat
          icon={<MessageSquare size={14} aria-hidden="true" />}
          label="Активность"
          value={String(metrics.activityCount)}
          detail={metrics.communicationCount
            ? `${metrics.communicationCount} коммуникаций · ${metrics.lastActivityLabel}`
            : metrics.lastActivityLabel}
        />
        <MiniStat
          icon={<ListTodo size={14} aria-hidden="true" />}
          label="Открытые задачи"
          value={String(metrics.openTasksCount)}
          detail="из исходного лида"
          tone={metrics.openTasksCount > 0 ? "warning" : "success"}
        />
      </div>

      <p className="text-[11px] leading-4 text-portal-muted">
        Оплата, маржа и SLA — демо до контуров `3.3` / `3.4`. Пошив берётся из снимков вариантов сборки, если они есть на позициях.
      </p>
    </div>
  );
}
