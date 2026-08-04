"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  markAllCollaborationNotificationsRead,
  markCollaborationNotificationRead,
  type CollaborationNotification,
} from "@/app/(workspace)/sales/orders/[orderId]/collaboration-actions";
import { PageContent, PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageToolbar } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

const kindLabels: Record<string, string> = {
  mention: "Упоминание",
  microtask_assigned: "Назначена задача",
  microtask_completed: "Задача выполнена",
};

type Props = {
  initialItems: CollaborationNotification[];
  initialUnreadCount: number;
  loadError?: string | null;
};

export function CollaborationNotificationsWorkspace({
  initialItems,
  initialUnreadCount,
  loadError = null,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [error, setError] = useState(loadError ?? "");
  const [pending, startTransition] = useTransition();

  function openNotification(row: CollaborationNotification) {
    startTransition(async () => {
      if (row.read_at == null) {
        const result = await markCollaborationNotificationRead(row.id);
        if (result.ok) {
          setItems((current) =>
            current.map((item) => (item.id === row.id ? result.data : item)),
          );
          setUnreadCount((count) => Math.max(0, count - 1));
        } else {
          setError(result.message);
          return;
        }
      }
      router.push(row.deep_link);
    });
  }

  function markAll() {
    startTransition(async () => {
      const result = await markAllCollaborationNotificationsRead();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setItems((current) =>
        current.map((item) =>
          item.read_at
            ? item
            : { ...item, read_at: new Date().toISOString() },
        ),
      );
      setUnreadCount(0);
    });
  }

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <PageToolbar
        start={
          <p className="text-sm text-portal-text-muted">
            Уведомления сотрудничества
            {unreadCount > 0 ? (
              <span className="ml-2 inline-flex rounded bg-portal-primary px-1.5 py-0.5 text-[11px] font-bold text-portal-primary-on">
                {unreadCount}
              </span>
            ) : null}
          </p>
        }
        end={
          <Button
            type="button"
            variant="secondary"
            className="h-8"
            disabled={pending || unreadCount === 0}
            onClick={markAll}
          >
            Прочитать все
          </Button>
        }
      />
      <PageContent size="compact" width="full">
        {error ? (
          <p
            className="mb-3 rounded-portal-md border border-portal-danger/30 bg-portal-danger-soft px-portal-4 py-portal-2 text-portal-body text-portal-danger"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <SectionCard
          title="Входящие"
          description="Упоминания и микрозадачи по заказам / техкартам"
          size="compact"
        >
          {items.length === 0 ? (
            <EmptyState
              title="Пока тихо"
              description="Когда вас упомянут в переписке заказа или назначат микрозадачу, запись появится здесь."
            />
          ) : (
            <ul className="divide-y divide-portal-border">
              {items.map((row) => {
                const unread = row.read_at == null;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={`flex w-full flex-col gap-1 px-1 py-3 text-left hover:bg-portal-surface-secondary ${
                        unread ? "bg-portal-primary-soft/40" : ""
                      }`}
                      disabled={pending}
                      onClick={() => openNotification(row)}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-portal-text-muted">
                          {kindLabels[row.kind] ?? row.kind}
                          {unread ? (
                            <span className="ml-2 rounded bg-portal-primary px-1.5 py-0.5 text-[10px] font-bold normal-case text-portal-primary-on">
                              новое
                            </span>
                          ) : null}
                        </span>
                        <span className="text-[11px] text-portal-text-subtle">
                          {dateFormatter.format(new Date(row.created_at))}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-portal-text">
                        {row.title}
                      </span>
                      <span className="text-sm text-portal-text-muted">{row.body}</span>
                      <span className="text-xs text-portal-primary">
                        Открыть: {row.deep_link}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <p className="mt-3 text-xs text-portal-text-muted">
          Переписка по заказу:{" "}
          <Link
            href="/sales/orders"
            className="text-portal-primary underline-offset-2 hover:underline"
          >
            заказы покупателей
          </Link>
          .
        </p>
      </PageContent>
    </PageLayout>
  );
}
