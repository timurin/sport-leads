"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import {
  Factory,
  ListTodo,
  Package,
  Percent,
  Scissors,
  Wallet,
} from "lucide-react";

import {
  updateOrderDiscount,
} from "@/app/(workspace)/sales/orders/[orderId]/order-discount-actions";
import {
  updateOrderPayment,
  type OrderPaymentStatus,
} from "@/app/(workspace)/sales/orders/[orderId]/order-execution-actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form-controls";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import {
  paidPercentFromDraft,
  type OrderCardMetricsModel,
} from "@/lib/sales/order-card-metrics";
import {
  orderPaymentStatusLabels,
  orderPaymentStatuses,
} from "@/lib/sales/order-details";

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

const paymentTone: Record<OrderPaymentStatus, StatusBadgeTone> = {
  unpaid: "neutral",
  partial: "warning",
  paid: "success",
};

export function SalesOrderMetrics({
  orderId,
  metrics,
  variant = "slim",
}: {
  orderId: string;
  metrics: OrderCardMetricsModel;
  variant?: "full" | "slim";
}) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [discountDraft, setDiscountDraft] = useState(metrics.discountPercent);
  const [paymentStatusDraft, setPaymentStatusDraft] = useState(metrics.paymentStatus);
  const [paidAmountDraft, setPaidAmountDraft] = useState(metrics.paidAmountValue);
  const [saving, setSaving] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    setDiscountDraft(metrics.discountPercent);
    setError(null);
  }, [metrics.discountPercent, orderId]);

  useEffect(() => {
    setPaymentStatusDraft(metrics.paymentStatus);
    setPaidAmountDraft(metrics.paidAmountValue);
    setPaymentError(null);
  }, [metrics.paymentStatus, metrics.paidAmountValue, orderId]);

  const livePaidPercent = paidPercentFromDraft(paidAmountDraft, metrics.amountValue);
  const paymentProgressTone = livePaidPercent >= 100
    ? "success"
    : livePaidPercent > 0
      ? "warning"
      : "danger";
  const productionTone = metrics.productionPercent >= 88
    ? "success"
    : metrics.productionPercent >= 40
      ? "primary"
      : "warning";

  const dirty =
    (discountDraft.trim() || "") !== (metrics.discountPercent.trim() || "");
  const paymentDirty =
    paymentStatusDraft !== metrics.paymentStatus
    || paidAmountDraft.trim() !== String(metrics.paidAmountValue).trim();

  async function saveDiscount() {
    setSaving(true);
    setError(null);
    try {
      const result = await updateOrderDiscount(orderId, discountDraft);
      if (!result.ok) {
        setError(result.message);
        setSaving(false);
        return;
      }
      pushToast("Скидка заказа сохранена", "success");
      router.refresh();
    } catch {
      setError("Не удалось сохранить скидку заказа.");
    }
    setSaving(false);
  }

  async function savePayment() {
    setSavingPayment(true);
    setPaymentError(null);
    try {
      const paidNum = Number(String(paidAmountDraft).replace(",", "."));
      const amountUnchanged =
        String(paidAmountDraft).trim() === String(metrics.paidAmountValue).trim();
      const amountProvided =
        paidAmountDraft.trim() !== "" && Number.isFinite(paidNum) && paidNum >= 0;
      // Prefer amount when typed; status-only when amount unchanged / empty.
      const result = await updateOrderPayment(
        orderId,
        !amountUnchanged && amountProvided
          ? { paidAmount: paidAmountDraft }
          : { paymentStatus: paymentStatusDraft },
      );
      if (!result.ok) {
        setPaymentError(result.message);
        setSavingPayment(false);
        return;
      }
      pushToast("Оплата обновлена", "success");
      router.refresh();
    } catch {
      setPaymentError("Не удалось сохранить оплату.");
    }
    setSavingPayment(false);
  }

  return (
    <div className="space-y-3" data-order-metrics="" data-order-metrics-variant={variant}>
      <div className="rounded-portal-lg border border-portal-border bg-portal-surface p-3 shadow-portal-sm">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-portal-muted">
              <Wallet size={13} aria-hidden="true" /> Итого по заказу
            </p>
            <p className="mt-1 text-xl font-bold tracking-tight text-portal-success tabular-nums">
              {metrics.amountLabel}
              <span className="ml-1.5 text-sm font-semibold text-portal-muted">
                {metrics.currencyCode}
              </span>
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <div className="flex justify-between gap-2">
                <dt className="text-portal-muted">Без НДС</dt>
                <dd className="font-semibold tabular-nums text-portal-text">{metrics.amountNetLabel}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-portal-muted">НДС</dt>
                <dd className="font-semibold tabular-nums text-portal-text">{metrics.vatAmountLabel}</dd>
              </div>
              <div className="flex justify-between gap-2 col-span-2">
                <dt className="text-portal-muted">Позиции</dt>
                <dd className="font-semibold tabular-nums text-portal-text">{metrics.itemsSubtotalLabel}</dd>
              </div>
            </dl>
          </div>
          <StatusBadge tone={paymentTone[metrics.paymentStatus]} size="compact">
            {metrics.paymentLabel}
          </StatusBadge>
        </div>

        <div className="mt-3 rounded-portal-md border border-portal-border/80 bg-portal-surface-secondary/40 p-2.5">
          <p className="text-[11px] font-medium text-portal-muted">
            Скидка на заказ, %
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Input
              className="w-24"
              inputMode="decimal"
              value={discountDraft}
              disabled={saving}
              aria-label="Процент скидки на заказ"
              placeholder="0"
              onChange={(event) => {
                setDiscountDraft(event.target.value);
                setError(null);
              }}
            />
            <Button
              type="button"
              variant="primary"
              disabled={saving || !dirty}
              onClick={() => void saveDiscount()}
            >
              {saving ? "Сохранение…" : "Применить"}
            </Button>
          </div>
          <p className="mt-1.5 text-[11px] text-portal-muted">
            Сумма скидки: {metrics.discountAmountLabel}
          </p>
          {error ? (
            <p className="mt-1.5 text-[11px] text-portal-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-3 rounded-portal-md border border-portal-border/80 bg-portal-surface-secondary/40 p-2.5">
          <p className="text-[11px] font-medium text-portal-muted">Оплата</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Select
              size="compact"
              className="min-w-[9rem]"
              value={paymentStatusDraft}
              disabled={savingPayment}
              aria-label="Статус оплаты"
              onChange={(event) => {
                setPaymentStatusDraft(event.target.value as OrderPaymentStatus);
                setPaymentError(null);
              }}
            >
              {orderPaymentStatuses.map((status) => (
                <option key={status} value={status}>
                  {orderPaymentStatusLabels[status]}
                </option>
              ))}
            </Select>
            <Input
              className="w-28"
              inputMode="decimal"
              value={paidAmountDraft}
              disabled={savingPayment}
              aria-label="Оплачено"
              placeholder="0"
              onChange={(event) => {
                setPaidAmountDraft(event.target.value);
                setPaymentError(null);
              }}
            />
            <Button
              type="button"
              variant="primary"
              disabled={savingPayment || !paymentDirty}
              onClick={() => void savePayment()}
            >
              {savingPayment ? "Сохранение…" : "Сохранить"}
            </Button>
          </div>
          {paymentError ? (
            <p className="mt-1.5 text-[11px] text-portal-danger" role="alert">
              {paymentError}
            </p>
          ) : null}
        </div>

        {variant === "full" ? (
          <div className="mt-3 space-y-2.5">
            <ProgressBar value={livePaidPercent} tone={paymentProgressTone} label="Оплата" />
            <ProgressBar value={metrics.productionPercent} tone={productionTone} label={metrics.productionLabel} />
          </div>
        ) : (
          <div className="mt-3">
            <ProgressBar value={livePaidPercent} tone={paymentProgressTone} label="Оплата" />
          </div>
        )}
      </div>

      {variant === "full" ? (
        <>
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
              icon={<ListTodo size={14} aria-hidden="true" />}
              label="Открытые задачи"
              value={String(metrics.openTasksCount)}
              detail="из исходного лида"
              tone={metrics.openTasksCount > 0 ? "warning" : "success"}
            />
          </div>
          <p className="text-[11px] leading-4 text-portal-muted">
            Скидка и оплата — редакторы. Пошив/маржа — до полного costing.
          </p>
        </>
      ) : null}
    </div>
  );
}
