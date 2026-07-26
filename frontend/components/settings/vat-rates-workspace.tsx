"use client";

import { useMemo, useState } from "react";

import { PageLayout } from "@/components/layout/page-layout";
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
import { Input } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  formatVatRatePercent,
  type VatRate,
} from "@/lib/vat-rates";

/** PT-02 catalog list for VAT rates (`DS-PT-02`). */
export function VatRatesWorkspace({ rates }: { rates: VatRate[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rates;
    return rates.filter((rate) => (
      rate.name.toLowerCase().includes(q)
      || formatVatRatePercent(rate.rate_percent).toLowerCase().includes(q)
    ));
  }, [query, rates]);

  return (
    <>
      <PageToolbar
        start={(
          <label className="relative flex h-portal-control-default w-full min-w-0 items-center md:min-w-56 md:flex-1 lg:max-w-sm">
            <span className="sr-only">Поиск ставок НДС</span>
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск: ставка НДС"
              aria-label="Поиск ставок НДС"
            />
          </label>
        )}
      />

      <div className="min-w-0 flex-1 p-portal-4 lg:p-portal-6">
        {filtered.length === 0 ? (
          <EmptyState
            title="Ставки НДС не найдены"
            description="Измените поисковый запрос или проверьте seed миграции."
            size="compact"
          />
        ) : (
          <DataTableFrame>
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>Наименование</DataTableHeaderCell>
                  <DataTableHeaderCell>Ставка</DataTableHeaderCell>
                  <DataTableHeaderCell>Статус</DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((rate) => (
                  <DataTableRow key={rate.id}>
                    <DataTableCell className="font-medium text-portal-text">
                      {rate.name}
                    </DataTableCell>
                    <DataTableCell className="tabular-nums">
                      {formatVatRatePercent(rate.rate_percent)}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge tone={rate.is_active ? "success" : "neutral"}>
                        {rate.is_active ? "Активна" : "Архив"}
                      </StatusBadge>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
            <ListTotals
              primary={`${filtered.length} из ${rates.length}`}
              secondary="Справочник ставок НДС"
            />
          </DataTableFrame>
        )}
      </div>
    </>
  );
}

export function VatRatesPageShell({ rates }: { rates: VatRate[] }) {
  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <VatRatesWorkspace rates={rates} />
    </PageLayout>
  );
}
