"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { PageContent, PageLayout } from "@/components/layout/page-layout";
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
import { Input } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { formatAmountWithCurrency } from "@/lib/money";
import {
  sewerMatchesQuery,
  type SewingPeriodPreset,
  type SewingSewerListItem,
} from "@/lib/production/sewing-cabinet";

const PERIODS: { value: SewingPeriodPreset; label: string }[] = [
  { value: "day", label: "День" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
];

export function SewingCabinetSewersWorkspace({
  items,
  loadError,
  period,
}: {
  items: SewingSewerListItem[];
  loadError?: string;
  period: SewingPeriodPreset;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => items.filter((item) => sewerMatchesQuery(item, query)),
    [items, query],
  );

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <PageToolbar
        start={
          <label className="relative flex h-portal-control-default w-full min-w-0 items-center md:min-w-56 md:flex-1 lg:max-w-sm">
            <span className="sr-only">Поиск швей</span>
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск: имя, логин"
              aria-label="Поиск швей"
            />
          </label>
        }
        end={
          <Link
            href="/production/sewing-cabinet"
            className="inline-flex h-portal-control-compact items-center rounded-portal-sm border border-portal-border bg-portal-surface px-portal-3 text-portal-caption font-medium text-portal-text"
          >
            Мой кабинет
          </Link>
        }
      />
      {loadError ? (
        <InlineAlert
          className="rounded-none border-x-0 border-t-0 border-b"
          tone="danger"
          size="compact"
        >
          {loadError}
        </InlineAlert>
      ) : null}
      <PageContent className="flex min-h-0 flex-1 flex-col gap-portal-3">
        <div className="flex min-w-0 flex-wrap gap-portal-2">
          {PERIODS.map((item) => (
            <Link
              key={item.value}
              href={`/production/sewing-cabinet/sewers?period=${item.value}`}
              className={`rounded-portal-full px-portal-3 py-1 text-portal-caption font-medium ring-1 ${
                period === item.value
                  ? "bg-portal-primary-soft text-portal-primary ring-portal-primary/20"
                  : "bg-portal-surface text-portal-muted ring-portal-border"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            title="Нет швей"
            description="Пользователи с правом кабинета появятся здесь. Заработок — embed за выбранный период."
          />
        ) : (
          <DataTableFrame>
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>Швея</DataTableHeaderCell>
                  <DataTableHeaderCell>Логин</DataTableHeaderCell>
                  <DataTableHeaderCell>В резерве</DataTableHeaderCell>
                  <DataTableHeaderCell>Заработок периода</DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((item) => (
                  <DataTableRow key={item.id}>
                    <DataTableCell className="font-medium">
                      <Link
                        href={`/production/sewing-cabinet/${item.id}`}
                        className="text-portal-primary hover:underline"
                      >
                        {item.display_name}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>@{item.login}</DataTableCell>
                    <DataTableCell>{item.reserved_count}</DataTableCell>
                    <DataTableCell>
                      {formatAmountWithCurrency(item.earnings_completed)}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
            <ListTotals
              primary={`${filtered.length} из ${items.length}`}
              secondary="Пользователи с правом кабинета швеи"
            />
          </DataTableFrame>
        )}
      </PageContent>
    </PageLayout>
  );
}
