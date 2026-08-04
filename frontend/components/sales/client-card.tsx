import Link from "next/link";

import { SimpleEntityCard } from "@/components/entity/simple-entity-card";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFrame,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityHeader } from "@/components/ui/entity-header";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ClientCardView } from "@/lib/sales/client-card-mapping";

const statusLabels = { new: "Новый", active: "Активный", paused: "Приостановлен" } as const;
const statusTones = {
  new: "primary",
  active: "success",
  paused: "neutral",
} as const;

const salesCurrency = (value: number) => `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;

type ClientCardProps = {
  client: ClientCardView;
  loadError?: string;
};

/** PT-05 client card (`DS-PT-05`). Persistent `/clients/{id}` — history panel → 2.2.3 / v1.00. */
export function ClientCard({ client, loadError }: ClientCardProps) {
  return (
    <SimpleEntityCard
      header={
        <EntityHeader
          eyebrow={
            <Link href="/sales/clients" className="text-portal-primary hover:underline">
              Клиенты
            </Link>
          }
          title={client.name}
          description={`${client.type} · ${client.city}`}
          status={
            <StatusBadge tone={statusTones[client.status]} size="compact">
              {statusLabels[client.status]}
            </StatusBadge>
          }
          meta={
            <span className="text-portal-caption text-portal-muted">
              Ответственный: {client.responsible.name}
            </span>
          }
          actions={
            <Link
              href="/sales/clients"
              className="portal-focus-ring inline-flex h-portal-control-default items-center justify-center gap-portal-2 rounded-portal-md border border-portal-border bg-portal-surface px-portal-4 text-portal-body font-medium text-portal-text hover:bg-portal-state-hover"
            >
              ← К списку
            </Link>
          }
        />
      }
    >
      {loadError ? (
        <InlineAlert tone="danger" size="compact">
          {loadError}
        </InlineAlert>
      ) : null}

      <SectionCard
        title="Реквизиты"
        description="Данные клиента из CRM (создание при конвертации лида / заказе)."
        size="compact"
      >
        <dl className="grid min-w-0 gap-portal-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Компания / название" value={client.name} />
          <Field label="Контактное лицо" value={client.contact} />
          <Field label="Телефон" value={client.phone} />
          <Field label="Email" value={client.email} />
          <Field label="Город" value={client.city} />
          <Field label="Вид спорта" value={client.sport} />
          <Field label="Заказов" value={String(client.ordersCount)} />
          <Field label="Сумма продаж" value={salesCurrency(client.salesAmount)} />
          <Field label="Обновлён" value={client.lastContact} />
        </dl>
      </SectionCard>

      <SectionCard
        title="Связанные заказы"
        description="Краткая сводка (до 20). Полная история лидов/заказов — Stage 2.2.3 / v1.00."
        size="compact"
      >
        {client.recentOrders.length === 0 ? (
          <EmptyState
            title="Заказов пока нет"
            description="Заказы появятся после конвертации лида или создания заказа на клиента."
            size="compact"
          />
        ) : (
          <DataTableFrame>
            <DataTable minWidthClassName="min-w-[720px]">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Номер</DataTableHeaderCell>
                  <DataTableHeaderCell>Название</DataTableHeaderCell>
                  <DataTableHeaderCell>Статус</DataTableHeaderCell>
                  <DataTableHeaderCell>Спорт</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Сумма</DataTableHeaderCell>
                  <DataTableHeaderCell>Создан</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {client.recentOrders.map((order) => (
                  <DataTableRow key={order.id}>
                    <DataTableCell className="font-semibold">
                      <Link href={order.href} className="text-portal-primary hover:underline">
                        {order.number}
                      </Link>
                    </DataTableCell>
                    <DataTableCell className="min-w-0 truncate">{order.title}</DataTableCell>
                    <DataTableCell className="text-portal-muted">{order.statusLabel}</DataTableCell>
                    <DataTableCell className="text-portal-muted">{order.sport}</DataTableCell>
                    <DataTableCell align="right" className="whitespace-nowrap font-medium">
                      {order.amountLabel}
                    </DataTableCell>
                    <DataTableCell className="whitespace-nowrap text-portal-muted">
                      {order.createdAtLabel}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        )}
      </SectionCard>
    </SimpleEntityCard>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-l-2 border-portal-border pl-portal-3">
      <dt className="text-portal-caption font-medium text-portal-muted">{label}</dt>
      <dd className="mt-1 min-w-0 truncate font-semibold text-portal-text">{value}</dd>
    </div>
  );
}
