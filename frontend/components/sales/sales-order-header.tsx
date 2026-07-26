"use client";

import Link from "next/link";
import { ArrowLeft, Check, Clipboard, Ellipsis, ExternalLink, MessageSquare } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { setOrderStatus } from "@/app/(workspace)/sales/orders/order-status-actions";
import { PageActions, PageContent } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import type { SalesOrderDetails } from "@/lib/sales/order-details";
import {
  orderStatusPresentation,
  orderWorkflowStatuses,
} from "@/lib/sales/order-list-api";
import type { OrderStatus } from "@/types/sales";

type OpenMenu = "status" | "more" | null;

const statusTones: Record<string, StatusBadgeTone> = {
  "bg-blue-500": "primary",
  "bg-cyan-500": "primary",
  "bg-violet-500": "primary",
  "bg-amber-500": "warning",
  "bg-orange-500": "warning",
  "bg-emerald-500": "success",
  "bg-slate-400": "neutral",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "—";
}

export function SalesOrderHeader({
  order,
  lastActivityAtLabel,
  onWrite,
  onStatusChange,
}: {
  order: SalesOrderDetails;
  lastActivityAtLabel: string;
  onWrite: () => void;
  onStatusChange?: (status: OrderStatus) => void;
}) {
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [notice, setNotice] = useState("");
  const [isPending, startTransition] = useTransition();
  const headerRef = useRef<HTMLElement>(null);
  const status = pendingStatus ?? order.statusCode;
  const isTerminal = status === "completed" || status === "cancelled";
  const currentIndex = orderWorkflowStatuses.indexOf(status);
  const presentation = orderStatusPresentation[status];
  const badgeTone = statusTones[presentation.accentClass] ?? "primary";

  useEffect(() => {
    if (!openMenu) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenMenu(null);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openMenu]);

  function chooseStatus(next: OrderStatus) {
    setOpenMenu(null);
    setNotice("");
    if (next === status) return;

    setPendingStatus(next);
    startTransition(async () => {
      const result = await setOrderStatus(order.id, next);
      if (result.ok) {
        onStatusChange?.(next);
      }
      setPendingStatus(null);
      setNotice(result.message);
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice("Ссылка на заказ скопирована.");
    } catch {
      setNotice("Не удалось скопировать ссылку. Скопируйте адрес из строки браузера.");
    } finally {
      setOpenMenu(null);
    }
  }

  return (
    <header
      ref={headerRef}
      data-complex-entity-header
      data-document-header
      className="border-b border-portal-border bg-portal-surface shadow-portal-sm"
    >
      <PageContent size="compact" width="full">
        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start md:gap-x-3">
          <Link
            href="/sales/orders"
            className="inline-flex h-9 w-fit items-center gap-1.5 rounded-[var(--portal-radius-md)] border border-portal-border bg-portal-surface px-3 text-sm font-medium text-portal-text hover:bg-portal-surface-secondary"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            К списку
          </Link>
          <div className="min-w-0 md:col-start-2 md:row-start-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <h1 className="min-w-0 text-xl font-bold tracking-tight text-portal-text sm:text-[25px]">
                Заказ {order.number}
              </h1>
              <StatusBadge tone={badgeTone} dot>
                {orderStatusPresentation[status].label}
              </StatusBadge>
            </div>
            <p className="mt-1 break-words text-base font-medium text-portal-text sm:text-[17px]">
              {order.title}
            </p>
          </div>
          <PageActions className="md:col-start-3 md:row-start-1 md:justify-end">
            <div className="relative">
              <Button
                type="button"
                aria-haspopup="menu"
                aria-expanded={openMenu === "more"}
                aria-label="Дополнительные действия с заказом"
                onClick={() => setOpenMenu((current) => (current === "more" ? null : "more"))}
                className="h-9 px-3"
              >
                <Ellipsis size={17} /> Ещё
              </Button>
              {openMenu === "more" ? (
                <div
                  className="absolute right-0 z-30 mt-2 w-60 rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface p-2 text-left shadow-[var(--portal-shadow-overlay)]"
                  role="menu"
                >
                  <Link
                    href={order.sourceLeadHref}
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => setOpenMenu(null)}
                  >
                    <ExternalLink size={15} /> Открыть исходный лид
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={copyLink}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <Clipboard size={15} /> Копировать ссылку
                  </button>
                </div>
              ) : null}
            </div>
          </PageActions>
        </div>

        <div className="mt-2 flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700">
                {initials(order.responsibleName)}
              </span>
              <span>
                <span className="text-slate-400">Ответственный:</span>{" "}
                <b className="font-medium text-slate-700">{order.responsibleName}</b>
              </span>
            </span>
            <span>
              <span className="text-slate-400">Клиент:</span>{" "}
              <b className="font-medium text-slate-700">{order.clientName}</b>
            </span>
            <span>
              <span className="text-slate-400">Сумма:</span>{" "}
              <b className="font-medium text-slate-700">{order.amount}</b>
            </span>
            <span>
              <span className="text-slate-400">Активность:</span>{" "}
              <b className="font-medium text-slate-700">{lastActivityAtLabel}</b>
            </span>
          </div>

          <PageActions
            className="w-full max-lg:grid max-lg:grid-cols-2 max-lg:gap-2 lg:w-auto lg:shrink-0"
            align="end"
          >
            <Button type="button" variant="primary" onClick={onWrite} className="h-9 w-full px-3 lg:w-auto">
              <MessageSquare size={16} /> Написать
            </Button>
            <div className="relative w-full max-lg:min-w-0 lg:w-auto">
              <Button
                type="button"
                disabled={isPending}
                aria-haspopup="menu"
                aria-expanded={openMenu === "status"}
                onClick={() => setOpenMenu((current) => (current === "status" ? null : "status"))}
                className="h-9 w-full px-3 lg:w-auto"
              >
                Статус
              </Button>
              {openMenu === "status" ? (
                <div
                  className="absolute left-0 z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface p-2 text-left shadow-[var(--portal-shadow-overlay)] sm:left-auto sm:right-0"
                  role="menu"
                >
                  {[...orderWorkflowStatuses, "cancelled" as const].map((item) => (
                    <button
                      key={item}
                      type="button"
                      role="menuitem"
                      disabled={item === status || isPending}
                      onClick={() => chooseStatus(item)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className={`size-2.5 rounded-full ${orderStatusPresentation[item].accentClass}`} />
                      <span className="flex-1">{orderStatusPresentation[item].title}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </PageActions>
        </div>

        {notice ? (
          <p className="mt-2 text-sm text-slate-600" role="status" aria-live="polite">
            {notice}
          </p>
        ) : null}

        <div
          className="lead-stage-rail relative mt-3 min-w-0 overscroll-x-contain"
          aria-label="Этапы заказа"
        >
          <div className="flex w-max min-w-full snap-x snap-mandatory gap-0 pb-1 xl:w-full xl:snap-none">
            {orderWorkflowStatuses.map((item, index) => {
              const isCurrent = item === status;
              const isDone = currentIndex >= 0 && index < currentIndex;
              return (
                <button
                  key={item}
                  type="button"
                  disabled={isTerminal || isPending || isCurrent}
                  onClick={() => chooseStatus(item)}
                  aria-current={isCurrent ? "step" : undefined}
                  title={orderStatusPresentation[item].title}
                  className={`lead-stage-step relative flex h-9 shrink-0 snap-start items-center justify-center gap-2 px-4 text-xs font-semibold transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 xl:min-w-0 xl:flex-1 ${isCurrent ? "bg-portal-primary text-white" : isDone ? "bg-blue-50 text-blue-800" : "bg-portal-surface-secondary text-portal-muted hover:bg-slate-200"} disabled:cursor-default`}
                >
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] ${isCurrent ? "bg-white text-blue-700" : "bg-white text-slate-600"}`}
                  >
                    {isDone ? <Check size={12} strokeWidth={3} /> : index + 1}
                  </span>
                  <span className="whitespace-nowrap">{orderStatusPresentation[item].title}</span>
                </button>
              );
            })}
            <button
              type="button"
              disabled={isTerminal || isPending}
              onClick={() => chooseStatus("cancelled")}
              title="Отменить заказ"
              className="lead-stage-step relative flex h-9 shrink-0 snap-start items-center justify-center gap-2 bg-red-50 px-4 text-xs font-semibold text-red-800 transition hover:bg-red-100 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-default xl:min-w-0 xl:flex-1"
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] text-slate-600">
                {orderWorkflowStatuses.length + 1}
              </span>
              <span className="whitespace-nowrap">Отмена</span>
            </button>
          </div>
        </div>
      </PageContent>
    </header>
  );
}
