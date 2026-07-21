import { ArrowLeft, ExternalLink } from "lucide-react";

import { PageContent } from "@/components/layout/page-layout";
import type { SalesOrderDetails, SalesOrderHistoryItem } from "@/lib/sales/order-details";
import type { Nomenclature, NomenclatureVariant } from "@/lib/nomenclature";
import { SalesOrderItems } from "@/components/sales/sales-order-items";
import { DataList } from "@/components/ui/data-list";
import { EntityLink } from "@/components/ui/entity-link";
import { StatusBadge } from "@/components/ui/status-badge";

export function SalesOrderPage({ order, history, nomenclature, variantsByNomenclature }: { order: SalesOrderDetails; history: SalesOrderHistoryItem[]; nomenclature: Nomenclature[]; variantsByNomenclature: Record<number, NomenclatureVariant[]> }) {
  return (
    <PageContent size="spacious">
      <EntityLink href="/sales/orders" className="text-sm font-medium">
        <ArrowLeft size={16} aria-hidden="true" />
        К списку заказов
      </EntityLink>

      <header className="mt-5 rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface p-5 shadow-[var(--portal-shadow-sm)]">
        <p className="text-sm font-medium text-portal-muted">Заказ покупателя {order.number}</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-portal-text">{order.title}</h1>
            <p className="mt-1 text-sm text-portal-muted">Создан {order.createdAt}</p>
          </div>
          <StatusBadge tone="primary">{order.status}</StatusBadge>
        </div>
      </header>

      <section className="mt-4 rounded-portal-lg border border-portal-border bg-portal-surface p-portal-5 shadow-portal-card" aria-label="Основные сведения о заказе">
        <DataList
          columns={3}
          items={[
            { id: "client", label: "Клиент", value: order.clientName },
            { id: "organization", label: "Организация", value: order.organizationName },
            { id: "responsible", label: "Ответственный", value: order.responsibleName },
            { id: "amount", label: "Сумма", value: order.amount },
            { id: "desiredDate", label: "Желаемая дата", value: order.desiredDate },
            { id: "source", label: "Источник", value: order.source },
            { id: "category", label: "Категория", value: order.productCategory },
            { id: "sport", label: "Вид спорта", value: order.sport },
            { id: "quantity", label: "Количество", value: order.quantity },
          ]}
        />
      </section>

      <section className="mt-4 rounded-[var(--portal-radius-md)] border border-portal-border bg-portal-surface p-4">
        <h2 className="text-base font-semibold text-portal-text">Исходный лид</h2>
        <p className="mt-1 text-sm text-portal-muted">Заказ создан конвертацией лида; связь сохранена в backend.</p>
        <EntityLink href={order.sourceLeadHref} className="mt-3 text-sm">
          Открыть исходный лид <ExternalLink size={15} aria-hidden="true" />
        </EntityLink>
      </section>

      <SalesOrderItems orderId={order.id} items={order.items} nomenclature={nomenclature} variantsByNomenclature={variantsByNomenclature} />

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
