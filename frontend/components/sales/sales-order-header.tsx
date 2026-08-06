"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Clipboard, ExternalLink, Ellipsis } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { setOrderStatus } from "@/app/(workspace)/sales/orders/order-status-actions";
import { PageContent } from "@/components/layout/page-layout";
import { IconButton } from "@/components/ui/button";
import { EntityHeader } from "@/components/ui/entity-header";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import type { SalesOrderDetails } from "@/lib/sales/order-details";
import {
  orderStatusPresentation,
  orderWorkflowStatuses,
} from "@/lib/sales/order-list-api";
import type { OrderStatus } from "@/types/sales";

type OpenMenu = "more" | null;

const statusTones: Record<string, StatusBadgeTone> = {
  "bg-blue-500": "primary",
  "bg-cyan-500": "primary",
  "bg-violet-500": "primary",
  "bg-amber-500": "warning",
  "bg-orange-500": "warning",
  "bg-emerald-500": "success",
  "bg-slate-400": "neutral",
};

export function SalesOrderHeader({
  order,
  onStatusChange,
}: {
  order: SalesOrderDetails;
  onStatusChange?: (status: OrderStatus) => void;
}) {
  const router = useRouter();
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [notice, setNotice] = useState("");
  const [isPending, startTransition] = useTransition();
  const headerRef = useRef<HTMLDivElement>(null);
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
    <div ref={headerRef} data-complex-entity-header data-document-header className="min-w-0">
      <PageContent size="compact" width="full" className="space-y-portal-3">
        <div className="rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4 shadow-portal-card sm:p-portal-5">
          <EntityHeader
            size="compact"
            eyebrow={
              <Link
                href="/sales/orders"
                className="inline-flex items-center gap-1.5 font-medium text-portal-primary hover:underline"
              >
                ← Заказы
              </Link>
            }
            title={`Заказ ${order.number}`}
            status={(
              <StatusBadge size="compact" tone={badgeTone} dot>
                {orderStatusPresentation[status].label}
              </StatusBadge>
            )}
            description={order.title}
            meta={(
              <span>
                Ответственный:{" "}
                <span className="font-medium text-portal-text">{order.responsibleName}</span>
              </span>
            )}
            actions={(
              <div className="relative flex flex-wrap items-center gap-1">
                {order.sourceLeadHref ? (
                  <IconButton
                    label="Открыть исходный лид"
                    variant="secondary"
                    onClick={() => router.push(order.sourceLeadHref!)}
                  >
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </IconButton>
                ) : null}
                <IconButton
                  label="Копировать ссылку"
                  variant="secondary"
                  onClick={copyLink}
                >
                  <Clipboard className="size-4" aria-hidden="true" />
                </IconButton>
                <IconButton
                  label="Дополнительные действия"
                  variant="secondary"
                  aria-haspopup="menu"
                  aria-expanded={openMenu === "more"}
                  onClick={() => setOpenMenu((current) => (current === "more" ? null : "more"))}
                >
                  <Ellipsis className="size-4" aria-hidden="true" />
                </IconButton>
                {openMenu === "more" ? (
                  <div
                    className="absolute right-0 top-full z-30 mt-2 w-60 rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface p-2 text-left shadow-[var(--portal-shadow-overlay)]"
                    role="menu"
                  >
                    {order.sourceLeadHref ? (
                      <Link
                        href={order.sourceLeadHref}
                        role="menuitem"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => setOpenMenu(null)}
                      >
                        <ExternalLink size={15} /> Открыть исходный лид
                      </Link>
                    ) : (
                      <p className="px-3 py-2 text-sm text-slate-500">
                        Заказ создан без лида
                      </p>
                    )}
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
            )}
          />
          {notice ? (
            <p className="mt-portal-3 text-portal-caption text-portal-muted" role="status" aria-live="polite">
              {notice}
            </p>
          ) : null}
        </div>

        <div
          className="lead-stage-rail relative min-w-0 overflow-hidden rounded-portal-lg border border-portal-border bg-portal-surface overscroll-x-contain shadow-portal-sm"
          aria-label="Этапы заказа"
        >
          <div className="flex w-max min-w-full snap-x snap-mandatory gap-0 xl:w-full xl:snap-none">
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
    </div>
  );
}
