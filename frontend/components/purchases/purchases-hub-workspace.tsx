import Link from "next/link";

import { PageLayout } from "@/components/layout/page-layout";

const LIVE_LINKS = [
  {
    href: "/purchases/orders",
    title: "Заказы поставщикам",
    detail: "Stage 13 — контур ещё не поставлен",
  },
  {
    href: "/purchases/suppliers",
    title: "Поставщики",
    detail: "Stage 13 — контур ещё не поставлен",
  },
  {
    href: "/warehouse/stock",
    title: "Связь со складом",
    detail: "Номенклатура и остатки (live)",
  },
] as const;

/** Soft UI purchases hub (`22.6.3`). No demo PO/supplier rows — Stage 13 is open. */
export function PurchasesHubWorkspace() {
  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <div className="sl-design-v1 flex min-h-0 min-w-0 flex-1 flex-col gap-3 bg-portal-page p-portal-4 text-portal-text">
        <section className="sl-soft-panel flex flex-wrap items-start justify-between gap-3 p-portal-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">Закупки</h1>
              <span className="rounded-full border border-portal-border px-2 py-0.5 text-portal-caption text-portal-muted">
                0 open
              </span>
            </div>
            <p className="mt-2 text-portal-caption text-portal-muted">
              Заказы поставщикам и поставщики появятся в Stage 13. Soft UI chrome
              без demo-подмены API.
            </p>
          </div>
          <Link
            href="/warehouse/movements"
            className="portal-focus-ring inline-flex h-9 items-center justify-center rounded-lg border border-portal-border bg-portal-surface px-3 text-sm font-medium text-portal-text"
          >
            Движения склада
          </Link>
        </section>

        <div className="grid gap-3 md:grid-cols-3">
          {LIVE_LINKS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="sl-soft-panel block p-portal-4 hover:bg-portal-state-hover"
            >
              <strong className="block text-sm font-semibold">{card.title}</strong>
              <span className="mt-1 block text-portal-caption text-portal-muted">
                {card.detail}
              </span>
            </Link>
          ))}
        </div>

        <section className="sl-soft-panel p-portal-4" id="orders">
          <h2 className="mb-2 text-sm font-semibold">Заказы поставщикам</h2>
          <p className="text-portal-caption text-portal-muted">
            Список пуст: нет API заказов поставщикам (`13.1.2`). Демо-строки
            эталона на live-маршрут не переносим.
          </p>
        </section>

        <section className="sl-soft-panel p-portal-4" id="suppliers">
          <h2 className="mb-2 text-sm font-semibold">Поставщики</h2>
          <p className="text-portal-caption text-portal-muted">
            Список пуст: нет API поставщиков (`13.1.1`). Карточки эталона не
            подменяют live данные.
          </p>
        </section>
      </div>
    </PageLayout>
  );
}
