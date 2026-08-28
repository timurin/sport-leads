"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { SupplierCreateDrawer } from "@/components/purchases/supplier-create-drawer";
import { PageLayout } from "@/components/layout/page-layout";
import { Button, IconButton } from "@/components/ui/button";
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
import { StatusBadge } from "@/components/ui/status-badge";
import {
  supplierMatchesQuery,
  type SupplierListView,
} from "@/lib/purchases/suppliers";

type Props = {
  suppliers: SupplierListView[];
  loadError?: string;
};

/** PT-02 suppliers list (`DS-PT-02`). */
export function SuppliersWorkspace({ suppliers, loadError }: Props) {
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(
    () => suppliers.filter((item) => supplierMatchesQuery(item, query)),
    [suppliers, query],
  );

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <PageToolbar
        start={(
          <label className="relative flex h-portal-control-default w-full min-w-0 items-center md:min-w-56 md:flex-1 lg:max-w-sm">
            <span className="sr-only">Поиск поставщиков</span>
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск: название, код, ИНН"
              aria-label="Поиск поставщиков"
            />
          </label>
        )}
        end={(
          <IconButton
            label="Создать поставщика"
            variant="primary"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-3.5" />
          </IconButton>
        )}
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

      <div className="min-w-0 flex-1 p-portal-4 lg:p-portal-6">
        {filtered.length === 0 ? (
          <EmptyState
            title={suppliers.length === 0 ? "Поставщиков пока нет" : "Ничего не найдено"}
            description={
              suppliers.length === 0
                ? "Создайте поставщика — demo-записи не подставляются."
                : "Измените поисковый запрос."
            }
            size="compact"
            action={
              suppliers.length === 0 ? (
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  Создать поставщика
                </Button>
              ) : null
            }
          />
        ) : (
          <DataTableFrame>
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableHeaderCell>Наименование</DataTableHeaderCell>
                  <DataTableHeaderCell>Код</DataTableHeaderCell>
                  <DataTableHeaderCell>ИНН</DataTableHeaderCell>
                  <DataTableHeaderCell>Телефон</DataTableHeaderCell>
                  <DataTableHeaderCell>Статус</DataTableHeaderCell>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((supplier) => (
                  <DataTableRow key={supplier.id}>
                    <DataTableCell className="font-medium text-portal-text">
                      <Link
                        href={`/purchases/suppliers/${supplier.id}`}
                        className="text-portal-primary hover:underline"
                      >
                        {supplier.name}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>{supplier.code || "—"}</DataTableCell>
                    <DataTableCell className="tabular-nums">
                      {supplier.inn || "—"}
                    </DataTableCell>
                    <DataTableCell>{supplier.phone || "—"}</DataTableCell>
                    <DataTableCell>
                      <StatusBadge
                        tone={supplier.isActive ? "success" : "neutral"}
                        size="compact"
                      >
                        {supplier.isActive ? "Активен" : "Архив"}
                      </StatusBadge>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
            <ListTotals
              primary={`${filtered.length} из ${suppliers.length}`}
              secondary="Поставщики закупок"
            />
          </DataTableFrame>
        )}
      </div>

      <SupplierCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </PageLayout>
  );
}
