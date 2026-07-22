import { ExternalLink } from "lucide-react";

import { DocumentCard } from "@/components/entity/document-card";
import { SalesOrderHeader } from "@/components/sales/sales-order-header";
import { SalesOrderItems } from "@/components/sales/sales-order-items";
import {
  ActivityTimeline,
  ActivityTimelineItem,
} from "@/components/ui/activity-timeline";
import { DataList } from "@/components/ui/data-list";
import { EntityLink } from "@/components/ui/entity-link";
import { SectionCard } from "@/components/ui/section-card";
import type { SalesOrderDetails, SalesOrderHistoryItem } from "@/lib/sales/order-details";
import type { Nomenclature, NomenclatureVariant } from "@/lib/nomenclature";

/** PT-07 reference document card (`DS-PT-07`). */
export function SalesOrderPage({
  order,
  history,
  nomenclature,
  variantsByNomenclature,
}: {
  order: SalesOrderDetails;
  history: SalesOrderHistoryItem[];
  nomenclature: Nomenclature[];
  variantsByNomenclature: Record<number, NomenclatureVariant[]>;
}) {
  return (
    <DocumentCard header={<SalesOrderHeader order={order} />}>
      <SectionCard title="Основные сведения" size="compact">
        <DataList
          columns={3}
          items={[
            { id: "client", label: "Клиент", value: order.clientName },
            {
              id: "organization",
              label: "Организация",
              value: order.organizationName,
            },
            {
              id: "responsible",
              label: "Ответственный",
              value: order.responsibleName,
            },
            { id: "amount", label: "Сумма", value: order.amount },
            {
              id: "desiredDate",
              label: "Желаемая дата",
              value: order.desiredDate,
            },
            { id: "source", label: "Источник", value: order.source },
            {
              id: "category",
              label: "Категория",
              value: order.productCategory,
            },
            { id: "sport", label: "Вид спорта", value: order.sport },
            { id: "quantity", label: "Количество", value: order.quantity },
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Исходный лид"
        description="Заказ создан конвертацией лида; связь сохранена в backend."
        size="compact"
      >
        <EntityLink href={order.sourceLeadHref} className="text-portal-body">
          Открыть исходный лид <ExternalLink size={15} aria-hidden="true" />
        </EntityLink>
      </SectionCard>

      <SalesOrderItems
        orderId={order.id}
        items={order.items}
        nomenclature={nomenclature}
        variantsByNomenclature={variantsByNomenclature}
        documentTotal={order.amount}
      />

      <SectionCard title="Описание" size="compact">
        <p className="whitespace-pre-wrap text-portal-body leading-6 text-portal-muted">
          {order.description}
        </p>
      </SectionCard>

      <SectionCard title="История заказа" size="compact">
        {history.length === 0 ? (
          <p className="text-portal-body text-portal-muted">
            История пока пуста.
          </p>
        ) : (
          <ActivityTimeline label="История заказа">
            {history.map((item) => (
              <ActivityTimelineItem
                key={item.id}
                title={item.title}
                description={item.message}
                meta={
                  <time dateTime={item.occurredAt}>{item.occurredAt}</time>
                }
                marker={
                  <span
                    className="block size-2 rounded-full bg-portal-primary"
                    aria-hidden="true"
                  />
                }
              />
            ))}
          </ActivityTimeline>
        )}
      </SectionCard>
    </DocumentCard>
  );
}
