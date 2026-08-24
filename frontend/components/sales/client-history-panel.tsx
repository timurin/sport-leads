"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CompactTabs } from "@/components/ui/compact-tabs";
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
import { InlineAlert } from "@/components/ui/inline-alert";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  filterClientHistoryItems,
  type ClientHistoryFilter,
  type ClientHistoryItemView,
} from "@/lib/sales/client-history";

const FILTERS: { id: ClientHistoryFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "lead", label: "Лиды" },
  { id: "order", label: "Заказы" },
];

type Props = {
  items: ClientHistoryItemView[];
  loadError?: string;
};

export function ClientHistoryPanel({ items, loadError }: Props) {
  const [kind, setKind] = useState<ClientHistoryFilter>("all");
  const visible = useMemo(
    () => filterClientHistoryItems(items, kind),
    [items, kind],
  );

  return (
    <SectionCard
      title="История"
      description="Лиды и заказы клиента. Пустой список не заменяется demo-данными."
      size="compact"
    >
      {loadError ? (
        <InlineAlert tone="danger" size="compact">
          {loadError}
        </InlineAlert>
      ) : null}

      <div className="mb-portal-3">
        <CompactTabs
          label="Фильтр истории"
          variant="pills"
          size="compact"
          value={kind}
          items={FILTERS.map((item) => ({
            id: item.id,
            label: item.label,
            count:
              item.id === "all"
                ? items.length
                : items.filter((row) => row.kind === item.id).length,
          }))}
          onChange={(id) => setKind(id as ClientHistoryFilter)}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Истории пока нет"
          description="Лиды появятся по заказу, конвертации или совпадению телефона/email. Заказы — после создания на этого клиента."
          size="compact"
        />
      ) : (
        <DataTableFrame>
          <DataTable minWidthClassName="min-w-[720px]">
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Тип</DataTableHeaderCell>
                <DataTableHeaderCell>Запись</DataTableHeaderCell>
                <DataTableHeaderCell>Статус</DataTableHeaderCell>
                <DataTableHeaderCell>Спорт</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Сумма</DataTableHeaderCell>
                <DataTableHeaderCell>Дата</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {visible.map((row) => (
                <DataTableRow key={`${row.kind}-${row.id}`}>
                  <DataTableCell className="text-portal-muted">
                    {row.kind === "lead" ? "Лид" : "Заказ"}
                  </DataTableCell>
                  <DataTableCell className="min-w-0 truncate font-semibold">
                    <Link
                      href={row.href}
                      className="text-portal-primary hover:underline"
                    >
                      {row.title}
                    </Link>
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge
                      tone={row.kind === "lead" ? "primary" : "success"}
                      size="compact"
                    >
                      {row.statusLabel}
                    </StatusBadge>
                  </DataTableCell>
                  <DataTableCell className="text-portal-muted">
                    {row.sport}
                  </DataTableCell>
                  <DataTableCell
                    align="right"
                    className="whitespace-nowrap font-medium"
                  >
                    {row.amountLabel ?? "—"}
                  </DataTableCell>
                  <DataTableCell className="whitespace-nowrap text-portal-muted">
                    {row.occurredAtLabel}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </DataTableFrame>
      )}
    </SectionCard>
  );
}
