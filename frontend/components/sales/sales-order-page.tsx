import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";

import { PageContent, ResponsiveGrid } from "@/components/layout/page-layout";
import type { SalesOrderDetails, SalesOrderHistoryItem } from "@/lib/sales/order-details";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--portal-radius-md)] border border-portal-border bg-portal-surface-secondary p-3">
      <dt className="text-xs font-medium text-portal-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-portal-text">{value}</dd>
    </div>
  );
}

export function SalesOrderPage({ order, history }: { order: SalesOrderDetails; history: SalesOrderHistoryItem[] }) {
  return (
    <PageContent size="spacious">
      <Link href="/sales/orders" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900">
        <ArrowLeft size={16} />
        К списку заказов
      </Link>

      <header className="mt-5 rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface p-5 shadow-[var(--portal-shadow-sm)]">
        <p className="text-sm font-medium text-portal-muted">Заказ покупателя {order.number}</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-portal-text">{order.title}</h1>
            <p className="mt-1 text-sm text-portal-muted">Создан {order.createdAt}</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">{order.status}</span>
        </div>
      </header>

      <section className="mt-4" aria-label="Основные сведения о заказе">
        <ResponsiveGrid minItemWidth="medium">
          <Detail label="Клиент" value={order.clientName} />
          <Detail label="Организация" value={order.organizationName} />
          <Detail label="Ответственный" value={order.responsibleName} />
          <Detail label="Сумма" value={order.amount} />
          <Detail label="Желаемая дата" value={order.desiredDate} />
          <Detail label="Источник" value={order.source} />
          <Detail label="Категория" value={order.productCategory} />
          <Detail label="Вид спорта" value={order.sport} />
          <Detail label="Количество" value={order.quantity} />
        </ResponsiveGrid>
      </section>

      <section className="mt-4 rounded-[var(--portal-radius-md)] border border-portal-border bg-portal-surface p-4">
        <h2 className="text-base font-semibold text-portal-text">Исходный лид</h2>
        <p className="mt-1 text-sm text-portal-muted">Заказ создан конвертацией лида; связь сохранена в backend.</p>
        <Link href={order.sourceLeadHref} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900">
          Открыть исходный лид <ExternalLink size={15} />
        </Link>
      </section>

      <section className="mt-4 rounded-[var(--portal-radius-md)] border border-portal-border bg-portal-surface p-4">
        <h2 className="text-base font-semibold text-portal-text">Описание</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-portal-muted">{order.description}</p>
      </section>

      <section className="mt-4 rounded-[var(--portal-radius-md)] border border-portal-border bg-portal-surface p-4">
        <h2 className="text-base font-semibold text-portal-text">История заказа</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-portal-muted">История пока пуста.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {history.map((item) => (
              <li key={item.id} className="border-l-2 border-blue-200 pl-3">
                <p className="text-sm font-semibold text-portal-text">{item.title}</p>
                <p className="mt-1 text-sm text-portal-muted">{item.message}</p>
                <time className="mt-1 block text-xs text-portal-muted" dateTime={item.occurredAt}>{item.occurredAt}</time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </PageContent>
  );
}
