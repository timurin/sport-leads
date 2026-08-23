import Link from "next/link";

import { PageLayout } from "@/components/layout/page-layout";

const SHORTCUTS = [
  {
    href: "/sales/leads",
    title: "Лиды",
    detail: "Список и карточки",
  },
  {
    href: "/production/orders",
    title: "Производство",
    detail: "Заказы / канбан",
  },
  {
    href: "/warehouse/stock",
    title: "Склад",
    detail: "Остатки / движения",
  },
  {
    href: "/purchases",
    title: "Закупки",
    detail: "Хаб модуля",
  },
] as const;

/** Soft UI home (`22.8.3`). Shortcuts only — etalon KPI/activity/tasks are demo. */
export function DashboardHomeWorkspace() {
  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <div className="sl-design-v1 flex min-h-0 min-w-0 flex-1 flex-col gap-3 bg-portal-page p-portal-4 text-portal-text">
        <section className="sl-soft-panel flex flex-wrap items-start justify-between gap-3 p-portal-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">
                Обзор платформы
              </h1>
              <span className="rounded-full border border-portal-border px-2 py-0.5 text-portal-caption text-portal-muted">
                Главная
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-portal-caption text-portal-muted">
              KPI, лента и задачи эталона — demo. На live-главной только переходы
              на существующие маршруты. Аналитика продаж — на отдельном дашборде.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/sales/dashboard"
              className="portal-focus-ring inline-flex h-9 items-center justify-center rounded-lg border border-portal-border bg-portal-surface px-3 text-sm font-medium text-portal-text"
            >
              Дашборд продаж
            </Link>
            <Link
              href="/sales/leads"
              className="portal-focus-ring inline-flex h-9 items-center justify-center rounded-lg border border-portal-border bg-portal-primary px-3 text-sm font-medium text-portal-primary-on"
            >
              Лиды
            </Link>
          </div>
        </section>

        <section className="sl-soft-panel p-portal-4">
          <h2 className="mb-3 text-sm font-semibold">Быстрые переходы</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SHORTCUTS.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4 hover:bg-portal-state-hover"
              >
                <strong className="block text-sm font-semibold">{card.title}</strong>
                <span className="mt-1 block text-portal-caption text-portal-muted">
                  {card.detail}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
